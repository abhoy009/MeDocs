import mongoose from "mongoose";

const Connection = async () => {
    const MongoURL = "";

    try {
        await mongoose.connect(MongoURL);
        console.log('DB connected');
    } catch (error) {
        console.log('Error while connecting to MongoDB:', error);
    }
};

export default Connection;
