import * as _ from 'lodash';

import {
	EntityFactory,
	EntitySpawner,
	Entity,
	IRawEntityAttributes,
	EntityUid,
} from './entities/entityFactory';
import { Set } from './entities/set';
import { Validator } from './validator';
import { deepFreeze } from './utils';
import { Adapter } from './adapters/base/adapter';
import { AdapterEntity } from './adapters/base/entity';
import { ModelDescriptionRaw, FieldDescriptor, ModelDescription, SourcesHash } from './types/modelDescription';
import { QueryLanguage } from './types/queryLanguage';
import { DataAccessLayer, TDataSource } from './adapters/dataAccessLayer';
import { IDataSourceRegistry, dataSourceRegistry } from './staticStores';

/**
 * The model class is used to interact with the population of all data of the same type.
 */
export class Model {
	public attributes: { [key: string]: FieldDescriptor };
	
	private readonly _dataSources: IDataSourceRegistry;
	public get dataSources() {
		return this._dataSources;
	}
	private readonly defaultDataSource: string;
	private readonly _entityFactory: EntitySpawner;
	public get entityFactory() {
		return this._entityFactory;
	}
	private readonly _validator: Validator;
	public get validator() {
		return this._validator;
	}
	
	public get ctor() {
		return this.constructor as typeof Model;
	}
	
	/**
	 * Create a new Model that is allowed to interact with all entities of data sources tables selected.
	 *
	 * @author gerkin
	 * @param name      - Name of the model.
	 * @param modelDesc - Hash representing the configuration of the model.
	 */
	public constructor(
		public name: string,
		modelDesc: ModelDescriptionRaw
	) {
		// Check model configuration
		if (
			!modelDesc.hasOwnProperty( 'sources' ) ||
			!(
				_.isArrayLike( modelDesc.sources ) ||
				_.isObject( modelDesc.sources ) ||
				_.isString( modelDesc.sources )
			)
		) {
			throw new TypeError(
				`Expect model sources to be either a string, an array or an object, had ${JSON.stringify(
					modelDesc.sources
				)}.`
			);
		}
		// Normalize our sources: normalized form is an object with keys corresponding to source name, and key corresponding to remaps
		const sourcesNormalized = Model.normalizeRemaps( modelDesc );
		// List sources required by this model
		const sourceNames = _.keys( sourcesNormalized );
		const modelSources = _.pick(
			dataSourceRegistry,
			sourceNames
		);
		const missingSources = _.difference( sourceNames, _.keys( modelSources ) );
		if ( 0 !== missingSources.length ) {
			throw new Error(
				`Missing data sources ${missingSources.map( v => `"${v}"` ).join( ', ' )}`
			);
		}
		
		if ( !_.isObject( modelDesc.attributes ) ) {
			throw new TypeError(
				`Model attributes should be an object, have ${JSON.stringify(
					modelDesc.attributes
				)}`
			);
		}
		
		// Now, we are sure that config is valid. We can configure our _dataSources with model options, and set `this` properties.
		const modelDescNormalized = modelDesc as ModelDescription;
		_.forEach( sourcesNormalized, ( remap, sourceName ) => {
			modelSources[sourceName].configureCollection( name, remap );
		} );
		this._dataSources = modelSources;
		this.defaultDataSource = _.chain( modelSources )
		.keys()
		.head()
		.value() as string;
		this._entityFactory = EntityFactory( name, modelDescNormalized, this );
		this._validator = new Validator( modelDescNormalized.attributes );
		// TODO: Normalize attributes before
		this.attributes = deepFreeze( modelDesc.attributes ) as {
			[key: string]: FieldDescriptor;
		};
	}
	
	/**
	 * TODO
	 * 
	 * @author Gerkin
	 * @param modelDesc - Description of the model to normalize remaps for
	 */
	protected static normalizeRemaps( modelDesc: ModelDescriptionRaw ){
		const sourcesRaw = modelDesc.sources;
		let sources: SourcesHash;
		if ( _.isString( sourcesRaw ) ) {
			sources = { [sourcesRaw]: {} };
		} else if ( _.isArrayLike( sourcesRaw ) ) {
			sources = _.zipObject( sourcesRaw, _.times( sourcesRaw.length, _.constant( {} ) ) );
		} else {
			sources = _.mapValues( sourcesRaw, ( remap, dataSourceName ) => {
				if ( true === remap ) {
					return {};
				} else if ( _.isObject( remap ) ) {
					return remap as object;
				} else {
					throw new TypeError(
						`Datasource "${dataSourceName}" value is invalid: expect \`true\` or a remap hash, but have ${JSON.stringify(
							remap
						)}`
					);
				}
			} );
		}
		return sources;
	}
	
	/**
	 * Generates a query object if the only provided parameter is an {@link EntityUid}.
	 * 
	 * @param query      - Entity ID or query to potentialy transform
	 * @param sourceName - Name of the source we want to query
	 */
	public ensureQueryObject( query: QueryLanguage.SelectQueryOrConditionRaw | EntityUid, sourceName: string = this.defaultDataSource ): QueryLanguage.SelectQueryOrConditionRaw {
		if ( typeof query === 'object' ){
			return query;
		} else {
			return {
				id: query,
			};
		}
	}
	
	/**
	 * Create a new Model that is allowed to interact with all entities of data sources tables selected.
	 *
	 * @author gerkin
	 * @throws  {Error} Thrown if requested source name does not exists.
	 * @param   dataSource - Name of the source to get. It corresponds to one of the sources you set in {@link Model#modelDesc}.Sources.
	 * @returns Source adapter with requested name.
	 */
	public getDataSource(
		dataSource: TDataSource = this.defaultDataSource
	): DataAccessLayer {
		if ( dataSource instanceof DataAccessLayer ){
			return dataSource;
		} else if ( dataSource instanceof Adapter ){
			return this._dataSources[dataSource.name];
		} else {
			return this._dataSources[dataSource];
		}
	}
	
	/**
	 * Create a new *orphan* {@link Entity entity}.
	 *
	 * @author gerkin
	 * @param   source - Object to copy attributes from.
	 * @returns New *orphan* entity.
	 */
	public spawn( source: object ): Entity {
		const newEntity = new this.entityFactory( source );
		return newEntity;
	}
	
	/**
	 * Create multiple new *orphan* {@link Entity entities}.
	 *
	 * @author gerkin
	 * @param   sources - Array of objects to copy attributes from.
	 * @returns Set with new *orphan* entities.
	 */
	public spawnMany( sources: object[] ): Set {
		return new Set( this, _.map( sources, source => this.spawn( source ) ) );
	}
	
	/**
	 * Insert a raw source object in the data store.
	 *
	 * @author gerkin
	 * @param   source         - Object to copy attributes from.
	 * @param   dataSourceName - Name of the data source to insert in.
	 * @returns Promise resolved with new *sync* {@link Entity entity}.
	 */
	public async insert(
		source: IRawEntityAttributes,
		dataSourceName: string = this.defaultDataSource
	): Promise<Entity | null> {
		return this.makeEntity( this.getDataSource( dataSourceName ).insertOne( this.name, source ) );
	}
	
	/**
	 * Insert multiple raw source objects in the data store.
	 *
	 * @author gerkin
	 * @param   sources        - Array of object to copy attributes from.
	 * @param   dataSourceName - Name of the data source to insert in.
	 * @returns Promise resolved with a {@link Set set} containing new *sync* entities.
	 */
	public async insertMany(
		sources: IRawEntityAttributes[],
		dataSourceName: string = this.defaultDataSource
	): Promise<Set> {
		return this.makeSet( this.getDataSource( dataSourceName ).insertMany( this.name, sources ) );
	}
	
	/**
	 * Retrieve a single entity from specified data source that matches provided `queryFind` and `options`.
	 *
	 * @author gerkin
	 * @param   queryFind      - Query to get desired entity.
	 * @param   options        - Options for this query.
	 * @param   dataSourceName - Name of the data source to get entity from.
	 * @returns Promise resolved with the found {@link Entity entity} in *sync* state.
	 */
	public async find(
		queryFind: QueryLanguage.SelectQueryOrConditionRaw | EntityUid,
		options: QueryLanguage.QueryOptionsRaw = {},
		dataSourceName: string = this.defaultDataSource
	): Promise<Entity | null> {
		const queryFindNoId = this.ensureQueryObject( queryFind );
  return this.makeEntity( this.getDataSource( dataSourceName ).findOne( this.name, queryFindNoId, options ) );
	}
	
	/**
	 * Retrieve multiple entities from specified data source that matches provided `queryFind` and `options`.
	 *
	 * @author gerkin
	 * @param   queryFind      - Query to get desired entities.
	 * @param   options        - Options for this query.
	 * @param   dataSourceName - Name of the data source to get entities from.
	 * @returns Promise resolved with a {@link Set set} of found entities in *sync* state.
	 */
	public async findMany(
		queryFind: QueryLanguage.SelectQueryOrConditionRaw,
		options: QueryLanguage.QueryOptionsRaw = {},
		dataSourceName: string = this.defaultDataSource
	): Promise<Set> {
		return this.makeSet( this.getDataSource( dataSourceName ).findMany( this.name, queryFind, options ) );
	}
	
	/**
	 * Update a single entity from specified data source that matches provided `queryFind` and `options`.
	 *
	 * @author gerkin
	 * @param   queryFind      - Query to get desired entity.
	 * @param   update         - Attributes to update on matched set.
	 * @param   options        - Options for this query.
	 * @param   dataSourceName - Name of the data source to get entity from.
	 * @returns Promise resolved with the updated {@link Entity entity} in *sync* state.
	 */
	public async update(
		queryFind: QueryLanguage.SelectQueryOrConditionRaw | EntityUid,
		update: object,
		options: QueryLanguage.QueryOptionsRaw = {},
		dataSourceName: string = this.defaultDataSource
	): Promise<Entity | null> {
		const queryFindNoId = this.ensureQueryObject( queryFind );
  return this.makeEntity( this.getDataSource( dataSourceName ).updateOne( this.name, queryFindNoId, update, options ) );
	}
	
	/**
	 * Update multiple entities from specified data source that matches provided `queryFind` and `options`.
	 *
	 * @author gerkin
	 * @param   queryFind      - Query to get desired entities.
	 * @param   update         - Attributes to update on matched set.
	 * @param   options        - Options for this query.
	 * @param   dataSourceName - Name of the data source to get entities from.
	 * @returns Promise resolved with the {@link Set set} of found entities in *sync* state.
	 */
	public async updateMany(
		queryFind: QueryLanguage.SelectQueryOrConditionRaw,
		update: object,
		options: QueryLanguage.QueryOptionsRaw = {},
		dataSourceName: string = this.defaultDataSource
	): Promise<Set> {
		return this.makeSet( this.getDataSource( dataSourceName ).updateMany( this.name, queryFind, update, options ) );
	}
	
	/**
	 * Delete a single entity from specified data source that matches provided `queryFind` and `options`.
	 *
	 * @author gerkin
	 * @param   queryFind      - Query to get desired entity.
	 * @param   options        - Options for this query.
	 * @param   dataSourceName - Name of the data source to get entity from.
	 * @returns Promise resolved with `undefined`.
	 */
	public async delete(
		queryFind: QueryLanguage.SelectQueryOrConditionRaw | EntityUid,
		options: QueryLanguage.QueryOptionsRaw = {},
		dataSourceName: string = this.defaultDataSource
	): Promise<void> {
		const queryFindNoId = this.ensureQueryObject( queryFind );
  return this.getDataSource( dataSourceName ).deleteOne( this.name, queryFindNoId, options );
	}
	
	/**
	 * Delete multiple entities from specified data source that matches provided `queryFind` and `options`.
	 *
	 * @author gerkin
	 * @param   queryFind      - Query to get desired entities.
	 * @param   options        - Options for this query.
	 * @param   dataSourceName - Name of the data source to get entities from.
	 * @returns Promise resolved with `undefined`.
	 */
	public async deleteMany(
		queryFind: QueryLanguage.SelectQueryOrConditionRaw,
		options: QueryLanguage.QueryOptionsRaw = {},
		dataSourceName: string = this.defaultDataSource
	): Promise<void> {
		return this.getDataSource( dataSourceName ).deleteMany( this.name, queryFind, options );
	}
	
	/**
	 * Generate a new Set containing provided `AdapterEntities` wrapped in `Entities`
	 * 
	 * @param dataSourceEntitiesPromise - Promise that may return adapter entities to wrap in a newly created `Set`
	 */
	protected async makeSet(
		dataSourceEntitiesPromise: Promise<Array<AdapterEntity | undefined>>
	){
		const dataSourceEntities = await dataSourceEntitiesPromise;
  const newEntities = _.chain( dataSourceEntities )
		.map( dataSourceEntity => new this.entityFactory( dataSourceEntity ) )
		.compact()
		.value();
  const set = new Set( this, newEntities );
  return set;
	}
	
	/**
	 * Generate a new entity from the promise's result
	 * 
	 * @author Gerkin
	 * @param dataSourceEntityPromise - Promise that may return an adapter entity to wrap in a newly created `Entity`
	 */
	protected async makeEntity(
		dataSourceEntityPromise: Promise<AdapterEntity | undefined>
	){
		const dataSourceEntity = await dataSourceEntityPromise;
		if ( _.isNil( dataSourceEntity ) ){
			return null;
		}
		return new this.entityFactory( dataSourceEntity );
	}
}
