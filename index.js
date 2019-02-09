"use strict";

var Service, Characteristic;
var airService;
var request = require('request');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
	
    homebridge.registerAccessory("homebridge-smogomierz", "Smogomierz", AirAccessory);
};

/**
 * Smogomierz Accessory
 */
function AirAccessory(log, config) {
    this.log = log;

    // Name of Smogomierz
    this.name = config['name'];

    // URL to Smogomierz sensor
    this.url = config['url'];

    if (!this.url) throw new Error("Smogomierz - you must provide a URL adress.");

    this.lastupdate = 0;
    this.cache = undefined;

    this.log.info("Smogomierz is working");
}


AirAccessory.prototype = {

    /**
     * Get all Smogomierz data from ESP8266
     */
    getAirData: function (callback) {
        var self = this;
        var PM25 = 0;
		
        var url = this.url + 'api';

        // Make request only every 10 minutes
        if (this.lastupdate === 0 || this.lastupdate + 600 < (new Date().getTime() / 1000) || this.cache === undefined) {

            request({
                url: url,
                json: true,
            }, function (err, response, data) {

                // If no errors
                if (!err && response.statusCode === 200) {
                    PM25 = self.updateData(data, 'Fetch');
                    callback(null, self.transformPM25(PM25));

                // If error
                } else {
                    airService.setCharacteristic(Characteristic.StatusFault, 1);
                    self.log.error("Smogomierz doesn't work or Unknown Error.");
                    callback(err);
                }

            });

            // Return cached data
        } else {
            PM25 = self.updateData(self.cache, 'Cache');
            callback(null, self.transformPM25(PM25));
        }
    },

    /**
     * Update data
     */
    updateData: function (data, type) {

        airService.setCharacteristic(Characteristic.StatusFault, 0);

        airService.setCharacteristic(Characteristic.PM2_5Density, roundInt(data.pm25));
        airService.setCharacteristic(Characteristic.PM10Density, roundInt(data.pm10));

        temperatureService.setCharacteristic(Characteristic.CurrentTemperature, roundInt(data.temperature));
        temperatureService.setCharacteristic(Characteristic.AtmosphericPressureLevel, roundInt(data.pressure));
        humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity, roundInt(data.humidity));

         var PM25 = data.pm25;

        this.log.info("[%s] PM2.5: %s.", type, PM25.toString());

        this.cache = data;

        if (type === 'Fetch') {
            this.lastupdate = new Date().getTime() / 1000;
        }

        return PM25;
    },

	// Based on Index level for PM2.5 http://www.eea.europa.eu/themes/air/air-quality-index
    transformPM25: function (PM25) {
        if (!PM25) {
            return (0); // Error or unknown response
        } else if (PM25 <= 10) {
            return (1); // Return EXCELLENT
        } else if (PM25 > 10 && PM25 <= 20) {
            return (2); // Return GOOD
        } else if (PM25 > 20 && PM25 <= 25) {
            return (3); // Return FAIR
        } else if (PM25 > 25 && PM25 <= 50) {
            return (4); // Return INFERIOR
        } else if (PM25 > 50) {
            return (5); // Return POOR (Homekit only goes to cat 5).
        } else {
            return (0); // Error or unknown response.
        }
    },

    identify: function (callback) {
        this.log("Identify requested!");
        callback(); // success
    },

    getServices: function () {
        var services = [];

        /**
         * Informations
         */
        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Hackerspace Silesia")
            .setCharacteristic(Characteristic.Model, "Software")
            .setCharacteristic(Characteristic.SerialNumber, "123-456");
        services.push(informationService);

        /**
         * AirService
         */
        airService = new Service.AirQualitySensor(this.name);

        airService
            .getCharacteristic(Characteristic.AirQuality)
            .on('get', this.getAirData.bind(this));

        airService.addCharacteristic(Characteristic.StatusFault);
        airService.addCharacteristic(Characteristic.PM2_5Density);
        airService.addCharacteristic(Characteristic.PM10Density);
        airService.addCharacteristic(Characteristic.CurrentTemperature);
        airService.addCharacteristic(Characteristic.AtmosphericPressureLevel);
        airService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
        services.push(airService);

        return services;
    }
};
