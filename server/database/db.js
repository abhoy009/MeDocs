import mongoose from "mongoose";

const Connection = async () => {
    const MongoURL = "mongodb+srv://abhoy009:pass@gdocs.heapy.mongodb.net/";

    try {
        await mongoose.connect(MongoURL);
        console.log('DB connected');
    } catch (error) {
        console.log('Error while connecting to MongoDB:', error);
    }
};

export default Connection;
