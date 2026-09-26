import secrets
from typing import List
from fastapi import FastAPI, HTTPException, Security, status, Query
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.models.schemas import (
    MerchantRegisterSchema,
    CouponRuleCreateSchema,
    ApplyPromoRequestSchema
)
from app.engine.evaluator import StackabilityEngine

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="Enterprise Programmable Discount Engine",
    description="SaaS Promo API with Module 1-6 Architecture Capabilities",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key_header = APIKeyHeader(name="X-Api-Key", auto_error=False)

async def get_current_merchant(api_key: str = Security(api_key_header)):
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing required X-Api-Key header.")
    db = get_database()
    merchant = await db["merchants"].find_one({"api_key": api_key, "is_active": True})
    if not merchant:
        raise HTTPException(status_code=403, detail="Invalid or deactivated API key.")
    return merchant

@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "online", "engine": "Enterprise Multi-Tenant Discount Engine v2.0"}

@app.post("/api/v1/merchants/register", tags=["Admin & Merchant Setup"])
async def register_merchant(payload: MerchantRegisterSchema):
    db = get_database()
    existing = await db["merchants"].find_one({"email": payload.email})
    if existing:
        return {
            "success": True,
            "message": "Merchant exists.",
            "merchant_id": str(existing["_id"]),
            "api_key": existing["api_key"]
        }

    api_key = f"pk_live_{secrets.token_hex(16)}"
    doc = {
        "store_name": payload.store_name,
        "email": payload.email,
        "api_key": api_key,
        "is_active": True
    }
    res = await db["merchants"].insert_one(doc)
    return {
        "success": True,
        "merchant_id": str(res.inserted_id),
        "api_key": api_key
    }

@app.post("/api/v1/promotions", tags=["Coupon & Rule Admin"])
async def create_promotion_rule(
    payload: CouponRuleCreateSchema,
    merchant: dict = Security(get_current_merchant)
):
    db = get_database()
    code_clean = payload.code.upper().strip()

    doc = payload.dict()
    doc["merchant_id"] = str(merchant["_id"])
    doc["code"] = code_clean
    doc["total_used"] = 0

    await db["promotions"].update_one(
        {"merchant_id": str(merchant["_id"]), "code": code_clean},
        {"$set": doc},
        upsert=True
    )
    return {"success": True, "message": f"Rule '{code_clean}' deployed successfully."}

@app.get("/api/v1/promotions", tags=["Coupon & Rule Admin"])
async def list_promotions(merchant: dict = Security(get_current_merchant)):
    db = get_database()
    cursor = db["promotions"].find({"merchant_id": str(merchant["_id"])}, {"_id": 0})
    promos = await cursor.to_list(length=100)
    return {"promotions": promos}

@app.post("/api/v1/cart/evaluate", tags=["Calculation & Storefront API"])
async def evaluate_cart(
    payload: ApplyPromoRequestSchema,
    merchant: dict = Security(get_current_merchant)
):
    db = get_database()
    clean_codes = [c.upper().strip() for c in payload.promo_codes]

    # Fetch matching rules
    cursor = db["promotions"].find({
        "merchant_id": str(merchant["_id"]),
        "code": {"$in": clean_codes},
        "is_active": True
    })
    rules = await cursor.to_list(length=50)

    # Fetch user redemptions history
    redemptions = {}
    for code in clean_codes:
        cnt = await db["redemptions"].count_documents({
            "merchant_id": str(merchant["_id"]),
            "code": code,
            "user_id": payload.cart.customer.user_id
        })
        redemptions[code] = cnt

    # Execute Stackability & Allocation Engine
    evaluation = StackabilityEngine.resolve_and_apply(
        rules=rules,
        cart=payload.cart.dict(),
        redemptions=redemptions
    )

    return {"success": True, "data": evaluation}