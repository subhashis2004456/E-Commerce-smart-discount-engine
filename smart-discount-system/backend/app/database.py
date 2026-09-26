import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("database")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "enterprise_discount_saas_db")

class Database:
    client: AsyncIOMotorClient = None

db_instance = Database()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB Database...")
    try:
        db_instance.client = AsyncIOMotorClient(
            MONGO_URI,
            maxPoolSize=10,
            minPoolSize=1
        )
        logger.info("Successfully connected to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise e

async def close_mongo_connection():
    logger.info("Closing MongoDB Database connection...")
    if db_instance.client:
        db_instance.client.close()
        logger.info("MongoDB Connection Closed.")

def get_database():
    if db_instance.client is None:
        raise Exception("Database client is not initialized.")
    return db_instance.client[DATABASE_NAME]