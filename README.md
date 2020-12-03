# mongo-to-s3-export
This project will run as a Lambda on AWS to export a mongodb collection to a file containing JSON in an AWS S3 bucket.

## Requirements
In order to run this service locally you will need the following:
- NodeJs v10.2 or greater
- Git

## Lambda environment variables
Key                | Description
-------------------|------------------------------------
`MONGO_DATABASE`   |The name of the mongo database containg the collection to export
`MONGO_COLLECTION` |The name of the mongo collection to export
`MONGO_URL`        |The mongo connection url containing username and password, hostname and port number. if using default username/password set both username and password to 'defaultauthdb' in the connection url.
`S3_PATH`          |The S3 bucket name and folder that will be used as the root location when exporting JSON files. Subfolders will be created under this location comprising of mongo db name and collection name.