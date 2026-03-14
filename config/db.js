/**
 * MongoDB connection. Use connect() from server.js and pass mongoose so
 * the rest of the app can use the same mongoose instance.
 */

function connect(mongoose, uri) {
    const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
    };
    return mongoose
        .connect(uri, options)
        .then(() => {
            console.log('MongoDB connected successfully');
            return mongoose.connection;
        })
        .catch((err) => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
        });
}

module.exports = { connect };
