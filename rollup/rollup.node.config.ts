import generateConfig from './rollup.base.config';

export default generateConfig( {
	minify: false,
	externalize: true,
	browser: false,
	useGlobals: false,
} );