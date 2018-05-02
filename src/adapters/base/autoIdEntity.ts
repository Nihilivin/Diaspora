import * as _ from 'lodash';

import { AdapterEntity, Adapter, IRawAdapterEntityAttributes } from '../base';
import { IRawEntityAttributes, EntityUid } from '../../entities/entityFactory';
import { generateUUID } from '../../utils';
import { Constructable } from './adapter-utils';

export const AutoIdAdapterEntity = <T extends Constructable<AdapterEntity>>(
	adapterEntity: T
): T => {
	return class AutoIdAdapterEntity extends adapterEntity {
		/**
		 * This decorator allows to add the ability to the entity to generates its own ID. It should be used when the underlying store objects does not generates IDs itself, like the {@link InMemoryAdapter}.
		 * 
		 * @author Gerkin
		 * @param attributes - Attributes of the entity 
		 * @param adapter    - Adapter that will persist the entity
		 * @param propName   - Property that should contain the ID
		 * @param id         - Value of the ID
		 */
		public static setId(
			attributes: IRawEntityAttributes,
			adapter: Adapter,
			propName: string = 'id',
			id: EntityUid = _.get( attributes, 'id', generateUUID() )
		): IRawAdapterEntityAttributes {
			const adapterEntityAttributes = _.merge( attributes, {
				id,
				idHash: {
					[adapter.name]: attributes[propName],
				},
			} );
			return adapterEntityAttributes;
		}

		/**
		 * Calls the static equivalient {@link AutoIdAdapterEntity.setId} on the attributes of the current adapter entity.
		 * 
		 * @author Gerkin
		 * @param adapter  - Adapter that will persist the entity
		 * @param propName - Property that should contain the ID
		 * @param id       - Value of the ID
		 */
		protected setId(
			adapter: Adapter,
			propName: string = 'id',
			id: EntityUid = _.get( this, 'attributes.id', generateUUID() )
		): this {
			this._attributes = AutoIdAdapterEntity.setId(
				this.attributes,
				adapter,
				propName,
				id
			);
			return this;
		}
	};
};
