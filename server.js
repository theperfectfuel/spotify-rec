var unirest = require('unirest');
var express = require('express');
var events = require('events');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                }
                else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {

    // First get the artist object from the user's name search
    // by calling getFromApi()
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    // Once the initial artist request has completed, or 'ended', 
    //we can get the ID and look up the related artists
    searchReq.on('end', function(item) {
        // Get artist object
        var artist = item.artists.items[0];


        // Get related artists from related artists endpoint
        var relatedReq = getFromApi('artists/' + artist.id + '/related-artists');

        relatedReq.on('end', function(list) {
            artist.related = list.artists;
            var numArtists = artist.related.length;
            var artistsChecked = 0;

            var checkDone = function() {
                if (artistsChecked === numArtists) {
                    res.json(artist);
                }
            };

            // Loop through related artists to get top track list
            artist.related.forEach(function(relatedArtist) {

                // Call getFromApi() again to get top track list for each related artist
                var trackReq = getFromApi('artists/' + relatedArtist.id + '/top-tracks', {country: 'US'});

                trackReq.on('end', function(trackList) {
                    relatedArtist.tracks = trackList.tracks;
                    artistsChecked++;
                    checkDone();
                });
                trackReq.on('error', function(code) {
                    res.sendStatus(code);
                });

            });

        });
        relatedReq.on('error', function(code) {
            res.sendStatus(code);
        });
        
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(8080);