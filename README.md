# Homebridge-Smogomierz
[![NPM Version](https://img.shields.io/npm/v/homebridge-smogomierz.svg)](https://www.npmjs.com/package/homebridge-smogomierz)

**Homebridge plugin for showing air condition data from Smogomierz sensor.**

Project is based on [homebridge-airly](https://github.com/beniaminrychter/homebridge-airly).

## Instalation
1. Install Homebridge using: `(sudo) npm install -g --unsafe-perm homebridge`.
1. Install this plugin using: `(sudo) npm install -g homebridge-smogomierz`.
1. Build your own Smogmomierz. Instrucions: <https://github.com/hackerspace-silesia/Smogomierz#readme>.
1. Find your Smogmomierz IP Adress. Example: http://192.168.1.7
1. Update your configuration file like the example below.

This plugin is returning data such as: PM1, PM2.5, PM10.

## Configuration
Example config.json

```json
"accessories": [
    {
          "accessory": "Smogomierz",
          "url": "SMOGOMIERZ_IP_ADRESS",
          "name": "Smogomierz Air Quality"
    }
]
```

## Config file
Fields:
- `accessory` must be "Smogomierz" (required).
- `url` adress of your Smogomierz sensor (required).
- `name` Is the name of accessory, you can change it! (required).