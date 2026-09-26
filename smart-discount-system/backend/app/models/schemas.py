from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class MerchantRegisterSchema(BaseModel):
    store_name: str = Field(..., example="Apex Global Commerce")
    email: str = Field(..., example="admin@apexstore.com")

class CartItemSchema(BaseModel):
    product_id: str = Field(..., example="prod_headphones")
    sku: str = Field(..., example="SKU-HEADPHONES")
    category: str = Field(..., example="electronics")
    price: float = Field(..., gt=0, example=500.0)
    quantity: int = Field(default=1, gt=0, example=1)

class CustomerSegmentSchema(BaseModel):
    user_id: str = Field(..., example="usr_1001")
    is_vip: bool = Field(default=False)
    order_count: int = Field(default=0, ge=0)
    region: Optional[str] = Field(default="GLOBAL")

class CartPayloadSchema(BaseModel):
    items: List[CartItemSchema]
    subtotal: float = Field(..., gt=0, example=800.0)
    shipping_cost: float = Field(default=50.0, ge=0.0)
    tax_rate: float = Field(default=0.18, ge=0.0) # 18% tax default
    customer: CustomerSegmentSchema

class ApplyPromoRequestSchema(BaseModel):
    promo_codes: List[str] = Field(..., example=["SUMMER2026", "FREESHIP"])
    cart: CartPayloadSchema

class BXGYConfigSchema(BaseModel):
    buy_sku: str
    buy_quantity: int
    get_sku: str
    get_quantity: int
    discount_percentage: float = 100.0  # 100 = Free

class BulkTierSchema(BaseModel):
    min_quantity: int
    max_quantity: Optional[int] = None
    unit_price: float

class CouponRuleCreateSchema(BaseModel):
    code: str = Field(..., example="SUMMER2026")
    description: Optional[str] = "Summer Sale Discount Engine"
    
    # Priority & Stacking
    priority: int = Field(default=10, description="Lower number = Higher Priority")
    is_exclusive: bool = Field(default=False, description="Cannot stack with other codes")
    
    # Discount Actions
    discount_type: str = Field(..., example="PERCENTAGE") # PERCENTAGE, FIXED, BXGY, TIERED, FREE_SHIPPING
    value: float = Field(default=0.0, ge=0.0)
    max_savings_cap: Optional[float] = Field(default=None)
    
    # Dynamic Configurations
    bxgy_config: Optional[BXGYConfigSchema] = None
    bulk_tiers: Optional[List[BulkTierSchema]] = None
    
    # Module 1: Rule & Condition Engine Filters
    min_subtotal: float = Field(default=0.0, ge=0.0)
    min_quantity: int = Field(default=0, ge=0)
    eligible_skus: List[str] = Field(default_factory=list)
    excluded_skus: List[str] = Field(default_factory=list)
    eligible_categories: List[str] = Field(default_factory=list)
    excluded_categories: List[str] = Field(default_factory=list)
    
    # Customer Segmentation
    requires_vip: bool = Field(default=False)
    new_user_only: bool = Field(default=False)
    eligible_regions: List[str] = Field(default_factory=list)
    
    # Module 3: Coupon Lifecycle Management
    per_user_limit: int = Field(default=1, ge=1)
    global_limit: Optional[int] = Field(default=None)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = Field(default=True)