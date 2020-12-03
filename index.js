'use strict';

const AWS = require('aws-sdk');
const fs = require('fs');
const url = require('url');
const exec = require('child_process').exec;

module.exports.handler = function(event, context, cb) {
    process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']
    console.log(process.env['PATH']);
    
    const mongoURI = process.env.MONGO_URL; // with port
    const mongoDBName = process.env.MONGO_DATABASE;
    const mongoCollection = process.env.MONGO_COLLECTION;
    const mongoURIparsed = url.parse(mongoURI);
    const mongoHost = mongoURIparsed.host;
    const mongoUsername = mongoURIparsed.auth ? mongoURIparsed.auth.split(':')[0] : undefined;
    const mongoPassword = mongoURIparsed.auth ? mongoURIparsed.auth.split(':')[1] : undefined;

    const s3Path = process.env.S3_PATH;
    // split s3Path into bucket name and folder
    const bucketName = s3Path.split('/', 1);
    const folder = s3Path.slice(bucketName[0].length).substring(1) + '/' + mongoCollection + '/';

    console.log(`bucketName = ${bucketName}`);
    console.log(`folder = ${folder}`);

    const s3bucket = new AWS.S3({
        params: {
            Bucket: s3Path
        }
    });

    const now = new Date();
    const outputFileName = mongoCollection + "/" + now.toDateString().replace(/ /g, '') + '_' + now.getTime();
    const tempFilePath = '/tmp/' + outputFileName;

    // clean bucket
    s3bucket.listObjects({ Bucket: bucketName[0], Delimiter: '/', Prefix: folder }, function(err, data) {
        if (err) {
            console.error(`Error listing bucket objects`, err);
            return;
        }
        const items = data.Contents;
        console.log(`Found: ${items.length} bucket objects`);

        for (let i = 0; i < items.length; i++) {
            const deleteParams = { Bucket: bucketName[0], Key: items[i].Key };
            s3bucket.deleteObject(deleteParams, function(err, data) {
                const fullFilePath = `${bucketName[0]}/${deleteParams.Key}`;
                if (err) {
                    console.error(`Delete error ${fullFilePath}`, err);
                } else {
                    console.log(`Deleted ${fullFilePath}`);
                }
            });
        }
    });

    // build mongo command
    let mongoExportCommand = 'mongoexport --host=' + mongoHost;
    if (mongoUsername !== 'defaultauthdb') {
        // username supplied so set username and password
        mongoExportCommand += ' --username=' + mongoUsername + ' --password=' + mongoPassword + ' --authenticationDatabase=admin';
    }
    mongoExportCommand += ' --db=' + mongoDBName + ' --collection=' + mongoCollection + ' --out=' + tempFilePath;

    // execute command
    exec(mongoExportCommand, function(error, stdout, stderr) {
        if (error) {
            console.error('exec error:', error);
            return;
        }

        fs.readFile(tempFilePath, function(err, data) {
            if (err) {
                console.error('ERROR', err);
                return;
            }
            s3bucket.createBucket(function() {
                let params = {
                    Key: outputFileName,
                    Body: data
                };
                s3bucket.upload(params, function(err, data) {
                    fs.unlink(tempFilePath, function(err) {
                        if (err) {
                            console.error('ERROR', err);
                        } else {
                            console.log(`Temp File Deleted ${tempFilePath}`);
                        }
                    });
                    if (err) {
                        console.error('ERROR', err);
                    } else {
                        console.log(`Successfully uploaded data to ${s3Path}/${outputFileName}`);
                    }
                });
            });
        });
    });
};
