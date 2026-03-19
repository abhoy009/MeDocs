import mongoose from "mongoose";

const Connection = async () => {
    const MongoURL = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/meDocs";

    try {
        mongoose.set('strictQuery', true);
        await mongoose.connect(MongoURL);
        console.log('DB connected');
    } catch (error) {
        console.log('Error while connecting to MongoDB:', error);
    }
};

export default Connection;
