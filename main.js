"use strict";

const utils = require("@iobroker/adapter-core");
const request = require("request");
//const ca = require("ssl-root-cas/latest").create();
let systemLanguage;
let piholeIntervall;
let piholeParseIntervall;
let url;
let bolReject;
let summaryTimeout;
const valuePaths = ["version","versions","type","summaryRaw","summary","topItems","getQuerySources","overTimeData10mins","getForwardDestinations"]; //disabled "getQueryTypes" for creating lots of spam entries

let adapter;
function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		name: "pi-hole",
		stateChange: function (id, state) {
			const command = id.split(".").pop();
            
			// you can use the ack flag to detect if it is status (true) or command (false)
			if (!state || state.ack) return;
			
			if (command == "deactPiHoleTime") {
				let deactTime = 0;

				if(state.val > 0) {
					deactTime = state.val;
				}

				deactivatePihole(deactTime);
				summaryTimeout = setTimeout(function(){
					getPiholeValues("summary");
					getPiholeValues("summaryRaw");
				}, 1000);
			}

			if (command == "actPiHole") {
				activatePihole();
				summaryTimeout = setTimeout(function(){
					getPiholeValues("summary");
					getPiholeValues("summaryRaw");
				}, 1000);
			}
		},
		unload: function (callback) {
			try {
				if (piholeIntervall) clearInterval(piholeIntervall);
				if (piholeParseIntervall) clearInterval(piholeParseIntervall);
				if (summaryTimeout) clearTimeout(summaryTimeout);
				adapter.log.info("cleaned everything up...");
				callback();
			} catch (e) {
				callback();
			}
		},
		ready: function () {
			adapter.getForeignObject("system.config", function (err, obj) {
				if (err) {
					adapter.log.error(err);
					return;
				} else if (obj) {
					if (!obj.common.language) {
						adapter.log.info("Language not set. English set therefore.");
					} else {
						systemLanguage = obj.common.language;
					}
					if (adapter.config.piholeAllCerts === true) {
						bolReject = false;
					} else {
						bolReject = true;
					}
					url = "http://" + adapter.config.piholeIP + "/admin/api.php?";
					main();
				}
			});
		}
	});
	adapter = new utils.Adapter(options);
    
	return adapter;
}

function string2number(input) {
	if (typeof(input) !== "string") {
		return input;
	}
	const output = parseFloat(input.replace(/,/g, ""));

	if(!isNaN(output)) {
		return output;
	} else {
		return input;
	}
}

function deactivatePihole(intSeconds){
	let timeOff = "";
	if (intSeconds) {
		timeOff = "=" + intSeconds;
	}

	const httpOptions = {
		url: "http://" + adapter.config.piholeIP + "/admin/api.php?disable" + timeOff + "&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true
	};

	const httpsOptions = {
		url: "https://" + adapter.config.piholeIP + "/admin/api.php?disable" + timeOff + "&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true,
		rejectUnauthorized: bolReject/*,
		ca: ca*/
	};

	let reqOptions;
	if (adapter.config.piholeHttps === true) {
		reqOptions = httpsOptions;
	} else {
		reqOptions = httpOptions;
	}
	
	request(reqOptions, function(error, response) {
		if (!error && response.statusCode == 200) {
			//everything okay
			adapter.log.info("pi-hole deactivated");
		} else {
			adapter.log.error(error);
		}
	});
}

function activatePihole(){	
	const httpOptions = {
		url: "http://" + adapter.config.piholeIP + "/admin/api.php?enable&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true
	};

	const httpsOptions = {
		url: "https://" + adapter.config.piholeIP + "/admin/api.php?enable&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true,
		rejectUnauthorized: bolReject/*,
		ca: ca*/
	};

	let reqOptions;
	if (adapter.config.piholeHttps === true) {
		reqOptions = httpsOptions;
	} else {
		reqOptions = httpOptions;
	}
	
	request(reqOptions, function(error, response) {
		if (!error && response.statusCode == 200) {
			//everything okay
			adapter.log.info("pi-hole activated");
		} else {
			adapter.log.error(error);
		}
	});
}

function getPiholeValues(strURL) {
	const httpOptions = {
		uri: "http://" + adapter.config.piholeIP + "/admin/api.php?" + strURL + "&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true
	};

	const httpsOptions = {
		uri: "https://" + adapter.config.piholeIP + "/admin/api.php?" + strURL + "&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true,
		rejectUnauthorized: bolReject/*,
		ca: ca*/
	};

	let reqOptions;
	if (adapter.config.piholeHttps === true) {
		reqOptions = httpsOptions;
	} else {
		reqOptions = httpOptions;
	}
	
	request(reqOptions, function(error, response, content) {
		if (!error && response.statusCode == 200) {
		//create channel for each specific url
			adapter.setObjectNotExists(
				strURL, {
					common: {
						name: strURL,
					},
					type: "channel"
				}
			);
			
			for (const i in content) {
				if (typeof(content[i]) !== "object") {
					if (content.hasOwnProperty(i)) {
						adapter.setObjectNotExists(
							strURL + "." + i, {
								type: "state",
								common: {
									name: i,
									type: typeof(string2number(content[i])),
									read: true,
									write: false,
									unit: "",
									role: "value"
								},
								native: {}
							}, function() {
								adapter.setState(
									strURL + "." + i,
									{val: string2number(content[i]), ack: true}
								)
							}	
						);
					}
				} else {
					if (content.hasOwnProperty(i)) {
						adapter.setObjectNotExists(
							strURL + "." + i, {
								common: {
									name: i,
								},
								type: "channel"
							}
						);
						
						for (const j in content[i]) {
							if (typeof(content[i][j]) !== "object") {
								if(strURL == "topItems" || strURL == "getQuerySources" || strURL == "overTimeData10mins" || strURL == "getForwardDestinations") {
									
									adapter.setObjectNotExists(
										strURL + "." + i + ".data-table", {
											type: "state",
											common: {
												name: "data-table",
												type: "string",
												read: true,
												write: false,
												unit: "",
												role: "table"
											},
											native: {}
										}, function() {
											adapter.setState(
												strURL + "." + i + ".data-table",
												{val: "[" + JSON.stringify(content[i]) + "]", ack: true}
											)
										}
									);
								} else {
									adapter.setObjectNotExists(
										strURL + "." + i + "." + j, {
											type: "state",
											common: {
												name: i,
												type: typeof(string2number(content[i][j])),
												read: true,
												write: false,
												unit: "",
												role: "value"
											},
											native: {}
										}, function() {
											adapter.setState(
												strURL + "." + i + "." + j,
												{val: string2number(content[i][j]), ack: true}
											)
										}
									);
								}
							} else {
								if (content[i].hasOwnProperty(j)) {
									adapter.setObjectNotExists(
										strURL + "." + i + "." + j, {
											common: {
												name: j,
											},
											type: "channel"
										}
									);

									for (const k in content[i][j]) {
										if (typeof(content[i][j][k]) !== "object") {
											adapter.setObjectNotExists(
												strURL + "." + i + "." + j + "." + k, {
													type: "state",
													common: {
														name: k,
														type: typeof(string2number(content[i][j][k])),
														read: true,
														write: false,
														unit: "",
														role: "value"
													},
													native: {}
												}, function() {
													adapter.setState(
														strURL + "." + i + "." + j + "." + k,
														{val: string2number(content[i][j][k]), ack: true}
													)
												}
											);
										}
									}
								}
							}
						}
					}
				}
			}

		} else {
			adapter.log.error(error);
		}
	});
}

function main() {	
	adapter.setObjectNotExists(
		"deactPiHoleTime", {
			type: "state",
			common: {
				name: "interval for deactivating pi-hole",
				type: "number",
				role: "value.interval",
				read: true,
				write: true
			},
			native: {}
		},
		adapter.subscribeStates("deactPiHoleTime")
	);

	adapter.setObjectNotExists(
		"actPiHole", {
			type: "state",
			common: {
				name: "activate pi-hole",
				type: "boolean",
				role: "button.start",
				read: true,
				write: true
			},
			native: {}
		},
		adapter.subscribeStates("actPiHole")
	);
	
	const httpOptions = {
		url: "http://" + adapter.config.piholeIP + "/admin/api.php?topItems&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true
	};

	const httpsOptions = {
		url: "https://" + adapter.config.piholeIP + "/admin/api.php?topItems&auth=" + adapter.config.piholeToken,
		method: "GET",
		json: true,
		rejectUnauthorized: bolReject/*,
		ca: ca*/
	};

	let reqOptions;
	if (adapter.config.piholeHttps === true) {
		reqOptions = httpsOptions;
	} else {
		reqOptions = httpOptions;
	}

	request(reqOptions, function(error, response) {
		if (!error && response.statusCode == 200) {
			adapter.setState(
				"info.connection",
				{val: true, ack: true}
			);
		}
	});
	
	valuePaths.forEach(function(item){
		getPiholeValues(item);
	});

	if(adapter.config.piholeRenew > 1) {
		piholeIntervall = setInterval(function(){
			valuePaths.forEach(function(item){
				getPiholeValues(item);
			});
		}, (adapter.config.piholeRenew * 1000));
	}
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
	module.exports = startAdapter;
} else {
	// or start the instance directly
	startAdapter();
} 