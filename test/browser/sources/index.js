'use strict';

/* globals l: false, c: false */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

require('./defineGlobals');

if (process.env.SAUCE_ONLY !== 'true') {
	(function () {
		if ('undefined' === typeof window && 'object' === (typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) && typeof exports.nodeName !== 'string') {
			global.Diaspora = require('../diaspora');
			global.expect = require('expect.js');
		}
	})();
	global.dataSources = {};
	describe('"check" feature', function () {
		it('Basic tests with types', function () {
			expect(Diaspora.check({
				test: 'string'
			}, {
				test: {
					type: 'any'
				}
			})).to.be.empty;
			expect(Diaspora.check({
				test: 1
			}, {
				test: {
					type: 'any'
				}
			})).to.be.empty;
			expect(Diaspora.check({
				string: 'string',
				number: 1,
				float: 1.5
			}, {
				string: {
					type: 'string'
				},
				number: {
					type: 'integer'
				},
				float: {
					type: 'float'
				}
			})).to.be.empty;
			expect(Diaspora.check({
				object: {
					string: 'string'
				},
				objectUndef: {
					aze: 'hello'
				},
				array: [1, 2, 3],
				arrayUndef: [1, 'aze', false, {}],
				arrayMultiDef: [1, 'aze', 1.5]
			}, {
				object: {
					type: 'object',
					attributes: {
						string: {
							type: 'string'
						}
					}
				},
				objectUndef: {
					type: 'object'
				},
				array: {
					type: 'array',
					of: {
						type: 'integer'
					}
				},
				arrayUndef: {
					type: 'array'
				},
				arrayMultiDef: {
					type: 'array',
					of: [{
						type: 'float'
					}, {
						type: 'string'
					}]
				}
			})).to.be.empty;
			expect(Diaspora.check({
				object: {
					string: null
				},
				objectUndef: {
					aze: null
				},
				array: [null],
				arrayUndef: [1, 'aze', false, null],
				arrayMultiDef: [1, 'aze', 1.5, null]
			}, {
				object: {
					type: 'object',
					attributes: {
						string: {
							type: 'string'
						}
					}
				},
				objectUndef: {
					type: 'object'
				},
				array: {
					type: 'array',
					of: {
						type: 'integer'
					}
				},
				arrayUndef: {
					type: 'array'
				},
				arrayMultiDef: {
					type: 'array',
					of: [{
						type: 'float'
					}, {
						type: 'string'
					}]
				}
			})).to.be.empty;
		});
		it('"required" property', function () {
			expect(Diaspora.check({
				test: 1
			}, {
				test: {
					type: 'any',
					required: true
				}
			})).to.be.empty;
			expect(Diaspora.check({
				test: 'string'
			}, {
				test: {
					type: 'any',
					required: true
				}
			})).to.be.empty;
			expect(Diaspora.check({
				test: null
			}, {
				test: {
					type: 'any',
					required: true
				}
			})).to.be.not.empty;
			expect(Diaspora.check({
				test: 'a'
			}, {
				test: {
					type: 'any',
					required: true
				}
			})).to.be.empty;
			expect(Diaspora.check({
				object: {
					string: null
				}
			}, {
				object: {
					type: 'object',
					attributes: {
						string: {
							type: 'string',
							required: true
						}
					}
				}
			})).to.be.not.empty;
			expect(Diaspora.check({
				object: null
			}, {
				object: {
					type: 'object',
					required: true,
					attributes: {
						string: {
							type: 'string'
						}
					}
				}
			})).to.be.not.empty;
			expect(Diaspora.check({
				object: null
			}, {
				object: {
					type: 'object',
					attributes: {
						string: {
							type: 'string',
							required: true
						}
					}
				}
			})).to.be.empty;
			expect(Diaspora.check({}, {
				rand: {
					type: 'number',
					required: true
				}
			})).to.be.not.empty;
			expect(Diaspora.check({
				rand: null
			}, {
				rand: {
					type: 'integer',
					required: true
				}
			})).to.be.not.empty;
			expect(Diaspora.check({
				rand: l.random(0, 100)
			}, {
				rand: {
					type: 'integer',
					required: true
				}
			})).to.be.empty;
		});
		it('"enum" property', function () {
			expect(Diaspora.check({
				test: 1
			}, {
				test: {
					type: 'any',
					enum: [1, 2, 'aze']
				}
			})).to.be.empty;
			expect(Diaspora.check({
				test: 'string'
			}, {
				test: {
					type: 'string',
					enum: ['string', 'hello']
				}
			})).to.be.empty;
			expect(Diaspora.check({
				test: 'string'
			}, {
				test: {
					type: 'string',
					enum: ['hello', 'world']
				}
			})).to.be.not.empty;
			expect(Diaspora.check({
				test: 'string'
			}, {
				test: {
					type: 'string',
					enum: ['hello', /^str/]
				}
			})).to.be.empty;
			expect(Diaspora.check({
				test: 'string'
			}, {
				test: {
					type: 'string',
					enum: ['hello', /^wo/]
				}
			})).to.be.not.empty;
		});
	});
	it('"default" feature', function () {
		expect(Diaspora.default({
			aze: 123
		}, {
			foo: {
				type: 'text',
				default: 'bar'
			}
		})).to.deep.equal({
			aze: 123,
			foo: 'bar'
		});
		var now = l.now();
		expect(Diaspora.default({
			aze: 123
		}, {
			foo: {
				type: 'datetime',
				default: function _default() {
					return now;
				}
			}
		})).to.deep.equal({
			aze: 123,
			foo: now
		});
		expect(Diaspora.default({
			aze: 'baz'
		}, {
			aze: {
				type: 'text',
				default: 'bar'
			}
		})).to.deep.equal({
			aze: 'baz'
		});
		expect(Diaspora.default({
			aze: 'baz'
		}, {
			aze: {
				type: 'datetime',
				default: function _default() {
					return 'bar';
				}
			}
		})).to.deep.equal({
			aze: 'baz'
		});
	});

	var styleFunction = 'undefined' === typeof window ? chalk.bold.underline.blue : l.identity;
	importTest(styleFunction('Adapters'), './adapters/index.js');
	importTest(styleFunction('Models'), './models/index.js');
}

if ('undefined' === typeof window && process.env.NO_SAUCE !== 'true') {
	require('./browser/selenium.js');
}