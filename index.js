'use strict';

const AWS = require('aws-sdk');
const fs = require('fs');
const url = require('url');

const exec = require('child_process').exec;

const mongoURI = process.env.MONGO_URL; //with port
const s3Path = process.env.S3_PATH;
const mongoURIparsed = url.parse(mongoURI);
const host = mongoURIparsed.host;
const dbName = mongoURIparsed.path.split('/')[1];

const username = mongoURIparsed.auth ? mongoURIparsed.auth.split(":")[0] : undefined;
const password = mongoURIparsed.auth ? mongoURIparsed.auth.split(":")[1] : undefined;

const s3bucket = new AWS.S3({
  params: {
    Bucket: s3Path
  }
});


module.exports.handler = function(event, context, cb) {
    process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']
    console.log(process.env['PATH']);
    let fileName = (new Date()).toDateString().replace(/ /g, "") +"_"+ (new Date()).getTime();
    let folderName = '/tmp/' + fileName 


    //split s3Path into bucket name and folder
    var bucketName = s3Path.split("/", 1);
    var folder = s3Path.slice(bucketName[0].length).substring(1) +'/'; 

    //clean out bucket
    s3bucket.listObjects({Bucket: bucketName[0], Delimiter: '/', Prefix: folder}, function (err, data) {
            if (err) {
                console.log("error listing bucket objects "+err);
                return;
            }
            var items = data.Contents;
            console.log("found: " + items.length + " objects");

            for (var i = 0; i < items.length; i += 1) {
                //console.log("delete: " + items[i].Key);
                var deleteParams = {Bucket: bucketName[0], Key: items[i].Key};
                //s3bucket.deleteObject(deleteParams);
                s3bucket.deleteObject(deleteParams, function (err, data) {
                    if (err) {
                        console.log("delete err " + deleteParams.Key);
                    } else {
                        console.log("deleted " + deleteParams.Key);
                    }
                });
            }
        });

    var connectionString ='mongoexport --host='+host+' --username='+username+' --password='+password+' --authenticationDatabase=admin --db='+dbName+' --collection=submissions --out=' + folderName;
    if (username=='defaultauthdb'){
        //dev has no auth
        connectionString ='mongoexport --host='+host+' --db='+dbName+' --collection=submissions --out=' + folderName;
    } else{
        connectionString ='mongoexport --host='+host+' --username='+username+' --password='+password+' --authenticationDatabase=admin --db='+dbName+' --collection=submissions --out=' + folderName;
    }

    exec(connectionString, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        let filePath = "/tmp/" + fileName;

        fs.readFile(filePath, function(err, data) {
            s3bucket.createBucket(function() {
                let params = {
                    Key: fileName, 
                    Body: data
                };
                s3bucket.upload(params, function(err, data) {
                    fs.unlink(filePath, function(err) {
                        if (err) {
                            console.error(err);
                        }
                        console.log('Temp File Delete');
                    });
                    if (err) {
                        console.log('ERROR', err);
                    } else {
                        console.log('Successfully uploaded data');

                    }
                });
            });
        });
    });
};
