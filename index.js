"use strict";

var Service, Characteristic;
var airQualitySensorService;
var temperatureSensorService;
var humiditySensorService;
var request = require('request');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-smogomierz", "Smogomierz", SmogomierzSensor);
};

const DataType = {
    PM2_5: 'pm2_5Type',
    PM10: 'pm10Type',
    AIRQUALITY: 'airQualityType',
    TEMPERATURE: 'temperatureType',
    HUMIDITY: 'humidityType'
};

class SmogomierzRepository {
    constructor(log, config) {
        this._cacheExpiryTime = config['cacheExpiryTime'] || 10
        this._isFetching = false
        this._callbackQueue = []

        this.log = log

        // URL to Smogomierz sensor
        this.url = config['url'];

        if (!this.url) throw new Error("Smogomierz - you must provide a URL adress.");

        this.lastupdate = 0;
        this.cache = undefined;
    }

    /**
     * Get all Smogomierz data from ESP8266
     */
    getData(callback) {
        var self = this;
        var url = this.url + 'api';

        if (self._isFetching) {
            self._callbackQueue.push(callback)
            return
        }

        if (this._shouldUpdate()) {
            self._isFetching = true

            request({
                url: url,
                json: true,
            }, function (err, response, data) {
                self._isFetching = false

                let callbackQueue = self._callbackQueue
                self._callbackQueue = []

                // If no errors
                if (!err && response.statusCode === 200) {
                    self.cache = data
                    self.lastupdate = new Date().getTime() / 1000;
                    callback(null, data, 'Fetch');

                    for (let c of callbackQueue) {
                        c(null, data, 'Cache');
                    }

                // If error
                } else {
                    self.log.error("Smogomierz doesn't work or Unknown Error.");
                    callback(err, null, null);

                    for (let c of callbackQueue) {
                        c(err, null, null);
                    }
                }
            });

        // Return cached data
        } else {
            callback(null, self.cache, 'Cache');
        }
    }

    _shouldUpdate() {
        let intervalBetweenUpdates = this._cacheExpiryTime * 60
        return this.lastupdate === 0 ||
                this.lastupdate + intervalBetweenUpdates < (new Date().getTime() / 1000) ||
                this.cache === undefined
    }
}

/**
 * Smogomierz Accessory
 */
function SmogomierzSensor(log, config) {
    this._names = config['servicesNames'] || {}

    this.log = log;
    this.smogomierzRepo = new SmogomierzRepository(log, config)

    this.log.info("Smogomierz setuped");
}

SmogomierzSensor.prototype = {
    getAirQuality: function(next) {
        var self = this

        self._getData(
            airQualitySensorService,
            DataType.AIRQUALITY,
            next
        )
    },

    getPm2_5: function(next) {
        var self = this

        self._getData(
            airQualitySensorService,
            DataType.PM2_5,
            next
        )
    },

    getPm10: function(next) {
        var self = this

        self._getData(
            airQualitySensorService,
            DataType.PM10,
            next
        )
    },

    getTemperature: function(next) {
        var self = this

        self._getData(
            temperatureSensorService,
            DataType.TEMPERATURE,
            next
        )
    },

    getHumidity: function(next) {
        var self = this

        self._getData(
            humiditySensorService,
            DataType.HUMIDITY,
            next
        )
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
         * airQualitySensorService
         */
        let airQualityName = this._names['airQuality'] || "Air Quality"
        airQualitySensorService = new Service.AirQualitySensor(airQualityName);

        airQualitySensorService
            .getCharacteristic(Characteristic.AirQuality)
            .on('get', this.getAirQuality.bind(this));

        airQualitySensorService
            .getCharacteristic(Characteristic.PM2_5Density)
            .on('get', this.getPm2_5.bind(this));

        airQualitySensorService
            .getCharacteristic(Characteristic.PM10Density)
            .on('get', this.getPm10.bind(this));

        services.push(airQualitySensorService);

        /**
         * temperatureSensorService
         */
        let temperatureName = this._names['temperature'] || "Temperature"
        temperatureSensorService = new Service.TemperatureSensor(temperatureName)

        temperatureSensorService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getTemperature.bind(this));

        services.push(temperatureSensorService);

        /**
         * humiditySensorService
         */
        let humidityName = this._names['humidity'] || "Humidity"
        humiditySensorService = new Service.HumiditySensor(humidityName)

        humiditySensorService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this));

        services.push(humiditySensorService);

        return services;
    },

    // PRIAVTE
    _getData: function(service, type, next) {
        var self = this

        self.smogomierzRepo.getData(function (error, data, source) {
            if (error) {
                service.setCharacteristic(Characteristic.StatusFault, 1);
                self.log(error.message);
                return next(error, null);
            }

            service.setCharacteristic(Characteristic.StatusFault, 0);

            let typeName = null
            let value = null

            switch (type) {
                case DataType.AIRQUALITY:
                    typeName = "AirQuality"
                    value = self._transformPM25ToAirQuality(data.pm25)
                    break;
                case DataType.PM2_5:
                    typeName = "PM2.5"
                    value = data.pm25
                    break;
                case DataType.PM10:
                    typeName = "PM10"
                    value = data.pm10
                    break;
                case DataType.TEMPERATURE:
                    typeName = "Temperature"
                    value = data.temperature
                    break;
                case DataType.HUMIDITY:
                    typeName = "Humidity"
                    value = data.humidity
                    break;
                default:
                    let error = new Error("Unknown data type: " + type)
                    self.log(error.message);
                    return next(error, null);
            }

            self.log.info("Update %s: %s from [%s].", typeName, value.toString(), source);

            return next(null, value);
          })
    },

	// Based on Index level for PM2.5 http://www.eea.europa.eu/themes/air/air-quality-index
    _transformPM25ToAirQuality: function (PM25) {
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
    }
};
