var express = require('express')
    , http = require('http')
    , path = require('path')
    , fs = require('fs')
    , util = require('util')
    , mongoose = require('mongoose')
    , jsdom = require('jsdom')
    , request = require('request')
    , async = require('async')
    , exec = require('child_process').exec
    , easyimg = require('easyimage')
    , uuid = require('node-uuid')
    , formidable = require('formidable');

var app = express();

db = mongoose.connect('mongodb://localhost/willyourapeme', {debug:true});
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once('open', function callback () {
    schema = mongoose.Schema({'id': String, 'name': String, 'dob': String, 'zip': Number, 'conviction': {}, 'pics': {}});
    OffenderModel = db.model('Offender', schema);
    console.log("Database Connection Established");

    // scrape()
    // train();
});

app.configure(function(){
    app.set('port', process.env.PORT || 9001);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
    app.use(express.errorHandler({dumpExceptions: true, showStack: true }));
});

app.get('/', function(req, res) {
    res.render('index.jade');
    //recognize("/Users/johnrussell/Desktop/input.jpg", function(err, offender) {
    //    res.send(JSON.stringify(offender));
    //});
});

app.post('/search', function(req, res) {

    console.log('Fired!');

    var form = new formidable.IncomingForm();
    form.uploadDir = __dirname;
    form.encoding = 'binary';

    form.addListener('file', function(name, file) {
        console.log(name);
        console.log(JSON.stringify(file));
    });

    form.addListener('end', function() {
        res.end();
    });

    form.parse(req, function(err, fields, files) {
        if (err) {
            console.log(err);
        }

        console.log('fields=' + JSON.stringify(fields));
    });

    console.log('Done!');


    /*

    var picId = uuid.v1();

    if (req.xhr) {
        console.log('It was!');
        console.log(JSON.stringify(req.xhr));
    }

    console.log(JSON.stringify(req.body));

    var x1 = req.body.payload.x1;
    var x2 = req.body.payload.x2;
    var y1 = req.body.payload.y1;
    var y2 = req.body.payload.y2;
    var img = req.body.payload.photo;

    console.log(x1);

    var width = x2 - x1 + 1;
    var height = y2 - y1 + 1;

    console.log('IMG=' + JSON.stringify(img));

    fs.writeFile(picId + '.jpg', img, function(err) {
        if(err) {
            console.log(err);
        } else {
            easyimg.rescrop({
                    src: picId + '.jpg', dst: picId + '.jpg',
                    width: 600, height: 480,
                    cropwidth: width, cropheight: height,
                    x: x1, y: y1,
                    gravity: 'NorthWest',
                    quality: 100
                },
                function(err, stdout, stderr) {
                    if (err) console.log(err);
                    console.log(stderr);
                    console.log(stdout);
                }
            );
        }
    });

    */
});

app.get('/result', function(req, res) {
    res.render('result.jade', {title: 'RESULTS'});
});

http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});

totalOffenders = 0;
processedOffenders = 0;

function recognize(path, callback) {
    exec("../Recognizer/Recognizer recognize " + path, function (error, stdout, stderr) {
        if (error) callback(error);
        var result = JSON.parse(stdout);

        console.log(JSON.stringify(result));

        OffenderModel.find({id: result.prediction}, function (err, offenders) {
            callback(null, offenders);
        });
    });
}

function train(callback) {
    console.log('Begin Training...');
    var offenderCount = 0;
    OffenderModel.find({}, function (err, offenders) {
        if (err) console.log(err);
        try {
            fs.unlinkSync('../data/pics.csv');
        } catch (e) {
            console.log('pics.csv doesnt exist or cant be deleted: ' + e);
        }
        offenders.forEach(function(offender) {
            var pics = 0;
            offenderCount ++;
            offender.pics.forEach(function(pic) {
              pics ++;
               if (pic.local !== 'default.jpg') {
                   fs.appendFileSync('../data/pics.csv', '/Users/johnrussell/Documents/workspace/willyourapeme/data/pics/' + pic.local +  ';' + offender.id + '\r\n');
                    if (offenderCount === offenders.length && pics ===offender.pics.length) {
                        exec("../Recognizer/Recognizer train ../data/pics.csv", function (error, stdout, stderr) {
                            callback(error);
                           // var is = fs.createReadStream('faces.yml')
                            //var os = fs.createWriteStream('../data/faces.yml');
                           // util.pump(is, os, function() {
                            //    fs.unlinkSync('faces.yml');
                            //    console.log(stdout);
                          //  });
                        });
                    }
               }
           });
        });
    });
};

function scrape(){
    var processedZips = [];
    var zips = fs.readFileSync(__dirname + '/../data/zips.csv').toString().split(',');
    async.forEachLimit(zips, 5, function (zip, callback){
        saveOffendersByZip(zip, function(zip) {
            if (zip && !processedZips.contains(zip)) {
                processedZips.push(zip);
                callback();
            } else if (zip === -1) {
                callback();
            }
        });
    }, function(err) {
        console.log('Done.');
    });
}

function saveOffendersByZip(zip, callback) {
    request('http://www.nvsexoffenders.gov/Search.aspx', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            jsdom.env(body, ["http://code.jquery.com/jquery.js"], function(error, dom) {
                if (!error) {
                    var $ = dom.$;
                    var firstViewState = $('[name=__VIEWSTATE]').val();
                    console.log('Fetching Offender List at Zip Code: ' + zip);
                    request({
                        url: "http://www.nvsexoffenders.gov/Search.aspx",
                        method: "POST",
                        form: {
                            '__VIEWSTATE': firstViewState,
                            'TextBoxLastName': '',
                            'TextBoxFirstName': '',
                            'TextBoxSSN': '',
                            'TextBoxStreet': '',
                            'DropDownListStreetType': '',
                            'TextBoxCity': '',
                            'TextBoxZipCode': zip,
                            'TextBoxLicensePlate': '',
                            'DropDownListState': '',
                            'ButtonSearch': 'Search'
                        },
                        followAllRedirects: true
                    }, function(error, response, body) {
                        if (!error && response.statusCode == 200) {
                            jsdom.env(body, ["http://code.jquery.com/jquery.js"], function(error, dom) {
                                if (!error) {
                                    var $ = dom.$;
                                    if ($('#ResultTable') && $('#ResultTable').length !== 0) {
                                        var secondViewState = $('[name=__VIEWSTATE]').val();
                                        $('#ResultTable tr td a:nth-child(1)').each(function(){
                                            var offenderId = ($(this).attr('id'));
                                            if (offenderId) {
                                                totalOffenders ++;
                                                console.log('Fetching Offender: ' + offenderId);
                                                saveOffenderById(secondViewState, offenderId, zip, function(err) {
                                                    if (err) {
                                                        return callback(-1);
                                                    } else {
                                                        if (processedOffenders + 5 == totalOffenders) {
                                                            console.log('Done processing zip: ' + zip + ' Request next zip code!')
                                                            return callback(zip);
                                                        } else {
                                                            console.log('Processed: ' + processedOffenders + '/' + totalOffenders);
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        console.log('The result table was not found.');
                                        return callback(-1);
                                    }
                                } else {
                                    console.log('Parsing HTML failed!');
                                    return callback(-1);
                                }
                            });
                        } else {
                            console.log('Fetching failed! Status: ' + response.statusCode);
                            return callback(-1);
                        }
                    });
                } else {
                    console.log('Parsing HTML failed!');
                    return callback(-1);
                }
            });
        } else {
            console.log('Fetching failed! Status: ' + response.statusCode);
            return callback(-1);
        }
    });
}

function saveOffenderById(secondViewState, offenderId, zip, callback) {
    request({
        url: "http://www.nvsexoffenders.gov/Search.aspx",
        method: "POST",
        form: {
            '__VIEWSTATE': secondViewState,
            '__EVENTTARGET': offenderId,
            '__EVENTARGUMENT': ''
        },
        followAllRedirects: false
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            jsdom.env(body, ["http://code.jquery.com/jquery.js"], function(error, dom) {
                if (!error) {
                    var $ = dom.$;
                    var parsedOffender = {};
                    parsedOffender.id = offenderId;
                    parsedOffender.zip = zip;
                    parsedOffender.pics = [];
                    console.log('Offender Fetched.');
                    if ($('#ResultTable') && $('#ResultTable').length !== 0) {
                        $('#ResultTable tr th').each(function() {
                            var header = $(this);
                            switch(header.text()) {
                                case 'Known Aliases':
                                    parsedOffender.name = clean(header.parent().next().children().text());
                                    break;
                                case 'Date(s) of Birth':
                                    parsedOffender.dob = clean(header.parent().next().children().text());
                                    break;
                                case 'Conviction':
                                    try {
                                        parsedOffender.conviction = {};
                                        var noError = true;
                                        while (noError) {
                                            var convictionInfoLine = header.parent().next().children().text();
                                            if (convictionInfoLine) {
                                                if (convictionInfoLine.split(':')[0] === 'Statute') {
                                                    parsedOffender.conviction.statute = clean(convictionInfoLine.split(':')[1]);
                                                } else if (convictionInfoLine.split(':')[0] === 'Conviction Description') {
                                                    parsedOffender.conviction.description = clean(convictionInfoLine.split(':')[1]);
                                                } else if (convictionInfoLine.split(':')[0] === 'Conviction Date') {
                                                    parsedOffender.conviction.date = clean(convictionInfoLine.split(':')[1]);
                                                }
                                            } else {
                                                noError = false;
                                            }
                                            header = header.parent().next().children();
                                        }
                                    }
                                    catch (e) {
                                        console.error(e);
                                    }
                                    break;
                            }
                        });
                        OffenderModel.update({id: parsedOffender.id}, {name: parsedOffender.name, zip: parsedOffender.zip, dob: parsedOffender.dob, conviction: parsedOffender.conviction, pics: parsedOffender.pics}, {upsert: true}).exec();
                        processedOffenders ++;
                        var callbackCalled = false;
                        var images = $.find('img');
                        for (var i = 0; i < images.length; i++) {
                            var path = $(images[i]).attr('src').slice(1);
                            if (path.indexOf('images/header.jpg') === -1) {
                                saveOffenderImage('http://www.nvsexoffenders.gov' + path, function(json) {
                                    parsedOffender.pics.push(json);
                                    console.log('Updating offender pics with id: ' + parsedOffender.id);
                                    OffenderModel.update({id: parsedOffender.id}, {name: parsedOffender.name, zip: parsedOffender.zip, dob: parsedOffender.dob, conviction: parsedOffender.conviction, pics: parsedOffender.pics}, {upsert: true}).exec();
                                });
                            }
                        }
                        return callback(false);
                    } else {
                        console.log('The result table was not found.');
                        return callback(true);
                    }
                } else {
                    console.log('Parsing HTML failed!');
                    return callback(true);
                }
            });
        } else {
            console.log('Fetching failed! Status: ' + response.statusCode);
            return callback(true);
        }
    });
};

function clean(s) {
    s = s.replace(/(^\s*)|(\s*$)/gi,"");
    s = s.replace(/[ ]{2,}/gi," ");
    s = s.replace(/\n /,"\n");
    return s;
}

function saveOffenderImage(url, callback) {
    console.log('Fetching Image: ' + url);
    http.get(url, function (img) {
        img.pipe(fs.createWriteStream(__dirname + '/../data/pics/' + url.split('/photos/')[1]));
        return callback({local: url.split('/photos/')[1], remote: url});
    });
}

Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}
