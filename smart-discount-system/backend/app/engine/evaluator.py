from datetime import datetime
from typing import Dict, Any, List, Optional
import math

class PromotionEvaluator:

    @staticmethod
    def validate_conditions(rule: Dict[str, Any], cart: Dict[str, Any], redemptions_count: int) -> Optional[str]:
        current_time = datetime.utcnow()
        
        # 1. Schedule Validation
        start_date = rule.get("start_date")
        end_date = rule.get("end_date")
        if start_date and isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date)
        if end_date and isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)

        if start_date and current_time < start_date:
            return f"Promotion '{rule['code']}' is not active yet."
        if end_date and current_time > end_date:
            return f"Promotion '{rule['code']}' has expired."

        # 2. Customer Segmentation
        customer = cart.get("customer", {})
        if rule.get("requires_vip") and not customer.get("is_vip"):
            return f"Code '{rule['code']}' is reserved for VIP members."
        if rule.get("new_user_only") and customer.get("order_count", 0) > 0:
            return f"Code '{rule['code']}' is valid for first-time orders only."
        
        eligible_regions = rule.get("eligible_regions", [])
        if eligible_regions and customer.get("region") not in eligible_regions:
            return f"Code '{rule['code']}' is not available in your region."

        # 3. Usage Limits
        if redemptions_count >= rule.get("per_user_limit", 1):
            return f"Usage limit reached for code '{rule['code']}'."
        if rule.get("global_limit") and rule.get("total_used", 0) >= rule["global_limit"]:
            return f"Global limit reached for code '{rule['code']}'."

        # 4. Cart Level Thresholds
        if cart.get("subtotal", 0.0) < rule.get("min_subtotal", 0.0):
            return f"Minimum subtotal of ${rule['min_subtotal']} required for '{rule['code']}'."

        total_qty = sum(item.get("quantity", 1) for item in cart.get("items", []))
        if total_qty < rule.get("min_quantity", 0):
            return f"Minimum {rule['min_quantity']} items required for code '{rule['code']}'."

        return None

    @staticmethod
    def calculate_discount(rule: Dict[str, Any], cart: Dict[str, Any]) -> Dict[str, Any]:
        discount_type = rule.get("discount_type")
        val = rule.get("value", 0.0)
        items = cart.get("items", [])
        discount_amount = 0.0
        shipping_discount = 0.0
        
        eligible_skus = rule.get("eligible_skus", [])
        excluded_skus = rule.get("excluded_skus", [])
        eligible_cats = rule.get("eligible_categories", [])
        excluded_cats = rule.get("excluded_categories", [])

        def is_item_eligible(item):
            if eligible_skus and item.get("sku") not in eligible_skus:
                return False
            if excluded_skus and item.get("sku") in excluded_skus:
                return False
            if eligible_cats and item.get("category") not in eligible_cats:
                return False
            if excluded_cats and item.get("category") in excluded_cats:
                return False
            return True

        applicable_items = [i for i in items if is_item_eligible(i)]
        applicable_subtotal = sum(i["price"] * i["quantity"] for i in applicable_items)

        if discount_type == "PERCENTAGE":
            discount_amount = (applicable_subtotal * val) / 100.0
        elif discount_type == "FIXED":
            discount_amount = min(val, applicable_subtotal)
        elif discount_type == "FREE_SHIPPING":
            shipping_discount = cart.get("shipping_cost", 0.0)
        elif discount_type == "BXGY" and rule.get("bxgy_config"):
            cfg = rule["bxgy_config"]
            buy_item = next((i for i in items if i["sku"] == cfg["buy_sku"]), None)
            get_item = next((i for i in items if i["sku"] == cfg["get_sku"]), None)
            if buy_item and get_item and buy_item["quantity"] >= cfg["buy_quantity"]:
                sets = buy_item["quantity"] // cfg["buy_quantity"]
                free_qty = min(sets * cfg["get_quantity"], get_item["quantity"])
                discount_amount = free_qty * get_item["price"] * (cfg["discount_percentage"] / 100.0)
        elif discount_type == "TIERED" and rule.get("bulk_tiers"):
            for item in applicable_items:
                qty = item["quantity"]
                for tier in sorted(rule["bulk_tiers"], key=lambda x: x["min_quantity"], reverse=True):
                    if qty >= tier["min_quantity"]:
                        savings_per_unit = max(0.0, item["price"] - tier["unit_price"])
                        discount_amount += savings_per_unit * qty
                        break

        # Max Savings Cap Application
        if rule.get("max_savings_cap") and discount_amount > rule["max_savings_cap"]:
            discount_amount = rule["max_savings_cap"]

        return {
            "item_discount": round(discount_amount, 2),
            "shipping_discount": round(shipping_discount, 2)
        }


class StackabilityEngine:

    @staticmethod
    def resolve_and_apply(rules: List[Dict[str, Any]], cart: Dict[str, Any], redemptions: Dict[str, int]) -> Dict[str, Any]:
        # Priority Ranking Sort (Lower integer = Higher Priority)
        sorted_rules = sorted(rules, key=lambda r: r.get("priority", 10))
        
        applied_rules = []
        rejected_rules = []
        
        total_item_discount = 0.0
        total_shipping_discount = 0.0
        is_exclusive_applied = False

        subtotal = cart["subtotal"]
        shipping_cost = cart["shipping_cost"]

        for rule in sorted_rules:
            if is_exclusive_applied:
                rejected_rules.append({"code": rule["code"], "reason": "An exclusive discount has already been applied."})
                continue

            error = PromotionEvaluator.validate_conditions(rule, cart, redemptions.get(rule["code"], 0))
            if error:
                rejected_rules.append({"code": rule["code"], "reason": error})
                continue

            calc = PromotionEvaluator.calculate_discount(rule, cart)
            
            # Check if this rule adds value
            if calc["item_discount"] <= 0 and calc["shipping_discount"] <= 0:
                rejected_rules.append({"code": rule["code"], "reason": "Coupon does not provide any discount on active cart items."})
                continue

            if rule.get("is_exclusive"):
                if applied_rules:
                    rejected_rules.append({"code": rule["code"], "reason": "Exclusive coupons cannot stack with existing discounts."})
                    continue
                is_exclusive_applied = True

            total_item_discount += calc["item_discount"]
            total_shipping_discount += calc["shipping_discount"]
            applied_rules.append(rule["code"])

        # Cap item discounts to total subtotal
        total_item_discount = min(total_item_discount, subtotal)
        total_shipping_discount = min(total_shipping_discount, shipping_cost)

        # Pro-Rata Line Item Allocation
        allocated_items = []
        net_subtotal = subtotal - total_item_discount

        for item in cart["items"]:
            item_total = item["price"] * item["quantity"]
            pro_rata_discount = (item_total / subtotal) * total_item_discount if subtotal > 0 else 0.0
            allocated_items.append({
                "product_id": item["product_id"],
                "sku": item["sku"],
                "unit_price": item["price"],
                "quantity": item["quantity"],
                "gross_total": round(item_total, 2),
                "allocated_discount": round(pro_rata_discount, 2),
                "net_total": round(item_total - pro_rata_discount, 2)
            })

        net_shipping = max(0.0, shipping_cost - total_shipping_discount)
        taxable_amount = net_subtotal + net_shipping
        tax_total = round(taxable_amount * cart.get("tax_rate", 0.18), 2)
        grand_total = round(net_subtotal + net_shipping + tax_total, 2)

        return {
            "applied_codes": applied_rules,
            "rejected_codes": rejected_rules,
            "summary": {
                "gross_subtotal": round(subtotal, 2),
                "item_discount_total": round(total_item_discount, 2),
                "net_subtotal": round(net_subtotal, 2),
                "gross_shipping": round(shipping_cost, 2),
                "shipping_discount_total": round(total_shipping_discount, 2),
                "net_shipping": round(net_shipping, 2),
                "tax_total": tax_total,
                "grand_total": grand_total
            },
            "allocated_line_items": allocated_items
        }