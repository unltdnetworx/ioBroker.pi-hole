const path = require('path');
const { tests } = require('@iobroker/testing');

const jscToolsMock = {
	getHostname() { return require("os").hostname() },
}

// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(path.join(__dirname, '..'), {
	// optionally define which modules should be mocked.
	additionalMockedModules: {
		"{CONTROLLER_DIR}/lib/tools.js": jscToolsMock,
		"{CONTROLLER_DIR}/lib/tools": jscToolsMock,
	},
});
