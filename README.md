# Spotify Jukebox
A jukebox made with the spotify API to use in our office so that everybody can contribute to the music being played.
It currently lives on a raspberry pi in our real life jukebox 

## Installing
This repository comes with the node modules compiled for the raspberry pi.

To change this just rename/delete the node_modules folder and run the command `npm install`.
You must then also download/compile the correct version of [node-spotify](http://www.node-spotify.com/)

Install [libspotify](https://developer.spotify.com/technologies/libspotify/) by going to [https://developer.spotify.com/technologies/libspotify/] and following the installation instructions there.

## Configuration
Before using this you must first [create an application](https://developer.spotify.com/my-applications/#!/) with a spotify developer account. And download the api key (in binary format)

You must create a config file containing the information used to login to spotify and the settings for the http server. A default config is provided below.

```javascript
    {
        "http":    {
            "ip":   "0.0.0.0",
            "port": 80
        },
        "spotify": {
            "apiKeyLocation": "./spotify_appkey.key",
            "clientId":      "<CHANGEME>",
            "clientSecret":   "<CHANGEME>"
        }
    }
```

On first launch it will ask for a username and password for a spotify account. This account needs to be premium (limitation of libspotify)

## Usage
To start the jukebox just type `node lib/app.js` within the root folder. 

**Note:** Must be superuser to start on port 80

## Credits
* [node-spotify](http://node-spotify.com)
* [handlebars.js](http://handlebarsjs.com/)
* [materialize](http://materializecss.com/)
* [spotify-web-api-js](https://github.com/JMPerez/spotify-web-api-js/)
* [jquery](http://jquery.com/)
* [async.js](https://github.com/caolan/async/)
* [express](http://expressjs.com/)
* [socket-io](http://socket.io/)
* [loudness](https://www.npmjs.com/package/loudness)
* [node-uuid](https://github.com/broofa/node-uuid)
* [promise](https://github.com/then/promise)
* [request](https://github.com/request/request)
* [nedb](https://github.com/louischatriot/nedb)
* [prompt](https://github.com/flatiron/prompt)
* [bower](http://bower.io)
* [polymer](https://www.polymer-project.org)

## License
[MIT](LICENSE)
