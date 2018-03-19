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
    //this.apikey = config['apikey'];

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
        var aqi = 0;
        var url = this.url + 'homebridge';


        // Make request only every 10 minutes
        if (this.lastupdate === 0 || this.lastupdate + 600 < (new Date().getTime() / 1000) || this.cache === undefined) {

            request({
                url: url,
                json: true,
                /*	For future API KEY
				headers: {
                    'apikey': self.apikey
                }*/
            }, function (err, response, data) {

                // If no errors
                if (!err && response.statusCode === 200) {

                    aqi = self.updateData(data, 'Fetch');
                    callback(null, self.transformAQI(aqi));

                    // If error
                } else {
                    airService.setCharacteristic(Characteristic.StatusFault, 1);
                    self.log.error("Smogomierz doesn't work or Unknown Error.");
					// DEBUG
					// self.log.error(err);
					// self.log.error(response.statusCode);
                    callback(err);
                }

            });

            // Return cached data
        } else {
            aqi = self.updateData(self.cache, 'Cache');
            callback(null, self.transformAQI(aqi));
        }
    },


    /**
     * Update data
     */
    updateData: function (data, type) {

        airService.setCharacteristic(Characteristic.StatusFault, 0);
		
        airService.setCharacteristic(Characteristic.PM2_5Density, data.pm25);
        airService.setCharacteristic(Characteristic.PM10Density, data.pm10);

         var aqi = data.pm25;
		
        this.log.info("[%s] Smogomierz air quality is: %s.", type, aqi.toString());

        this.cache = data;

        if (type === 'Fetch') {
            this.lastupdate = new Date().getTime() / 1000;
        }

        return aqi;
    },

	
    /** For futer AQI support
     * Return Air Quality Index
     * @param aqi
     * @returns {number}
     */
	// Based on Index level for PM2.5 http://www.eea.europa.eu/themes/air/air-quality-index 
    transformAQI: function (aqi) {
        if (!aqi) {
            return (0); // Error or unknown response
        } else if (aqi <= 10) {
            return (1); // Return EXCELLENT
        } else if (aqi > 10 && aqi <= 20) {
            return (2); // Return GOOD
        } else if (aqi > 20 && aqi <= 25) {
            return (3); // Return FAIR
        } else if (aqi > 25 && aqi <= 50) {
            return (4); // Return INFERIOR
        } else if (aqi > 50) {
            return (5); // Return POOR (Homekit only goes to cat 5, so combined the last two AQI cats of Very Unhealty and Hazardous.
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
        services.push(airService);


        return services;
    }
};

