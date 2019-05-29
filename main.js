"use strict";

const utils = require("@iobroker/adapter-core");
const request = require("request");
let systemLanguage;
let nameTranslation;
let piholeIntervall;
let valTagLang;
let url;
const valuePaths = ["getQueryTypes","version","type","summaryRaw","summary","topItems","getQuerySources","overTimeData10mins","getForwardDestinations"];
const c = request.jar();

let adapter;
function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		name: "pi-hole",
		stateChange: function (id, state) {
			let command = id.split(".").pop();
            
			// you can use the ack flag to detect if it is status (true) or command (false)
			if (!state || state.ack) return;
			
			if (command == "deactPiHoleTime") {
				
				adapter.log.error("Deaktiviert")
				if (piholeIntervall) clearInterval(piholeIntervall);
				let deactTime = 0;

				if(state.val > 0) {
					deactTime = state.val;
				}

				deactivatePihole(deactTime);
			}

			if (command == "actPiHole") {
				if (piholeIntervall) clearInterval(piholeIntervall);
				activatePihole();
			}
		},
		unload: function (callback) {
			try {
				if (piholeIntervall) clearInterval(piholeIntervall);
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
						//nameTranslation = require(__dirname + "/admin/i18n/en/translations.json")
					} else {
						systemLanguage = obj.common.language;
						//nameTranslation = require(__dirname + "/admin/i18n/" + systemLanguage + "/translations.json")
					}
					url = "http://" + adapter.config.piholeIP + "/admin/api.php?";
					main();
				}
			});
		}
	});
	adapter = new utils.Adapter(options);
    
	return adapter;
};

function deactivatePihole(intSeconds){
	let timeOff = "";
	if (intSeconds) {
		timeOff = "=" + intSeconds;
	}
	
	request(
		{
			url: "http://" + adapter.config.piholeIP + "/admin/api.php?disable" + timeOff + "&auth=" + adapter.config.piholeToken,
			json: true
		},
		function(error, response, content) {

			if (!error && response.statusCode == 200) {
				//everything okay
				adapter.log.warn("pi-hole deactivated");
			} else {
				adapter.log.error(error);
			}
		}

	);
}

function activatePihole(){	
	request(
		{
			url: "http://" + adapter.config.piholeIP + "/admin/api.php?enable&auth=" + adapter.config.piholeToken,
			json: true
		},
		function(error, response, content) {

			if (!error && response.statusCode == 200) {
				//everything okay
				adapter.log.warn("pi-hole activated");
			} else {
				adapter.log.error(error);
			}
		}

	);
}

function translateName(strName) {
	if(nameTranslation[strName]) {
		return nameTranslation[strName];
	} else {
		return strName;
	}
}

function getPiholeValues(strURL) {
	request(
		{
			url: "http://" + adapter.config.piholeIP + "/admin/api.php?" + strURL + "&auth=" + adapter.config.piholeToken,
			json: true
		},
		function(error, response, content) {

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
										type: ioBrokerTypeOf(typeof(content[i])),
										read: true,
										write: false,
										unit: "",
										role: "value"
									},
									native: {}
								},
								adapter.setState(
									strURL + "." + i,
									{val: content[i], ack: true}
								)
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
													type: "object",
													read: true,
													write: false,
													unit: "",
													role: "table"
												},
												native: {}
											},
											adapter.setState(
												strURL + "." + i + ".data-table",
												{val: content[i], ack: true}
											)
										);
									} else {
										adapter.setObjectNotExists(
											strURL + "." + i + "." + j, {
												type: "state",
												common: {
													name: i,
													type: ioBrokerTypeOf(typeof(content[i][j])),
													read: true,
													write: false,
													unit: "",
													role: "value"
												},
												native: {}
											},
											adapter.setState(
												strURL + "." + i + "." + j,
												{val: content[i][j], ack: true}
											)
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
															type: ioBrokerTypeOf(typeof(content[i][j][k])),
															read: true,
															write: false,
															unit: "",
															role: "value"
														},
														native: {}
													},
													adapter.setState(
														strURL + "." + i + "." + j + "." + k,
														{val: content[i][j][k], ack: true}
													)
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
		}

	);
}

function ioBrokerTypeOf(typeInput) {
	switch (typeInput) {
		case "boolean":
			return "indicator.working";
		case "number":
			return "value";
		case "string":
			return "text";
		default:
			return "state";
	}
	
}

function main() {
	adapter.setObjectNotExists(
		"deactPiHoleTime", {
			type: "state",
			common: {
				//name: translateName("managerReboot"),
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
				//name: translateName("managerReboot"),
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
	
	request(
		{
			url: "http://" + adapter.config.piholeIP + "/admin/api.php?topItems&auth=" + adapter.config.piholeToken,
			json: true
		},
		function(error, response, content) {

			if (!error && response.statusCode == 200) {
				adapter.setState(
					"info.connection",
					{val: true, ack: true}
				);
			}
		}
	);
	
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