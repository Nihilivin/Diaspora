import * as _ from 'lodash';

import { ValidationError } from './validationError';
import { EntityTransformers } from '../entityTransformers/checkTransformer';

import IErrorObjectFinal = EntityTransformers.CheckTransformer.IErrorObjectFinal;

/**
 * This class represents an error related to validation on an entity.
 */
export class EntityValidationError extends ValidationError {
	private readonly validationErrors: { [key: string]: IErrorObjectFinal };
	/**
	 * Construct a new validation error.
	 */
	public constructor(
		validationErrors: { [key: string]: IErrorObjectFinal },
		message: string,
		...errorArgs: any[]
	) {
		super( message, ...errorArgs );
		this.validationErrors = validationErrors;
		this.message += `
		${this.stringifyValidationError()}`;
	}
	
	/**
	 * Generates a string to display a single problem on the validation
	 *
	 * @author Gerkin
	 * @param error - Description of the error
	 */
	private static stringifyErrorComponent( error: IErrorObjectFinal ) {
		return `${JSON.stringify( error.value )}
	* ${_.chain( error ).omit( ['value'] ).values().map( _.identity ).value()}`;
	}
	
	/**
	 * Returns a readable description of the validation error
	 *
	 * @author Gerkin
	 */
	protected stringifyValidationError() {
		return _.chain( this.validationErrors )
		.mapValues(
			( error, key ) =>
			`${key} => ${EntityValidationError.stringifyErrorComponent( error )}`
		)
		.values()
		.join( '\n* ' )
		.value();
	}
}
