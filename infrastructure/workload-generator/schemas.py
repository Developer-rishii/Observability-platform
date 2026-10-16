from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    price: float
    available_quantity: int
    created_at: datetime

class OrderCreate(BaseModel):
    product_id: int = Field(..., gt=0, description="Valid product ID")
    quantity: int = Field(..., gt=0, description="Quantity must be at least 1")
    customer_name: str = Field(..., min_length=1, max_length=100, description="Customer full name")
    customer_email: str = Field(..., min_length=3, max_length=100, description="Customer email address")

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    total_price: float
    customer_name: str
    customer_email: str
    status: str
    created_at: datetime

class CpuFaultRequest(BaseModel):
    duration: int = Field(10, ge=1, le=120, description="CPU stress duration in seconds (1 - 120)")

class LatencyFaultRequest(BaseModel):
    latency_ms: int = Field(500, ge=0, le=3000, description="Artificial latency in milliseconds (0 - 3000)")
    duration: int = Field(10, ge=1, le=120, description="Fault duration in seconds (1 - 120)")

class DiskFillRequest(BaseModel):
    size_mb: int = Field(50, ge=1, le=500, description="Megabytes of test data to write (1 - 500)")
