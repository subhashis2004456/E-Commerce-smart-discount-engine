class EnterpriseDiscount {
    constructor(config = {}) {
        this.apiKey = config.apiKey || null;
        this.baseUrl = config.baseUrl || "http://127.0.0.1:8000/api/v1";
    }

    async evaluateCart(codes = [], cartPayload = {}) {
        // Attempt to request real backend API calculation
        try {
            const response = await fetch(`${this.baseUrl}/cart/evaluate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": this.apiKey || ""
                },
                body: JSON.stringify({
                    codes: codes,
                    cart: cartPayload
                })
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data };
            }
        } catch (err) {
            console.warn("Backend API not reachable. Running client-side discount engine fallback.");
        }

        // CLIENT-SIDE FALLBACK CALCULATION
        return this.localEvaluateFallback(codes, cartPayload);
    }

    localEvaluateFallback(codes = [], payload = {}) {
        const items = payload.items || [];
        const grossSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        let itemDiscount = 0;
        let shippingDiscount = 0;
        let appliedCodes = [];

        // Simple evaluation rule matching
        codes.forEach(code => {
            const cleanCode = code.toUpperCase();
            if (cleanCode === "DIS2026" || cleanCode === "DIS200") {
                itemDiscount += grossSubtotal * 0.20; // 20% Off
                appliedCodes.push(cleanCode);
            } else if (cleanCode === "FREESHIP") {
                shippingDiscount = payload.shipping_cost || 0;
                appliedCodes.push(cleanCode);
            }
        });

        const grossShipping = grossSubtotal > 0 ? (payload.shipping_cost || 50.0) : 0.0;
        const netSubtotal = Math.max(0, grossSubtotal - itemDiscount);
        const netShipping = Math.max(0, grossShipping - shippingDiscount);
        
        const taxRate = payload.tax_rate || 0.18;
        const taxTotal = netSubtotal * taxRate;
        const grandTotal = netSubtotal + netShipping + taxTotal;

        // Pro-rata distribution across items
        const allocatedItems = items.map(item => {
            const lineTotal = item.price * item.quantity;
            const itemShare = grossSubtotal > 0 ? (lineTotal / grossSubtotal) : 0;
            const itemAllocatedDiscount = itemDiscount * itemShare;
            return {
                sku: item.sku,
                quantity: item.quantity,
                allocated_discount: itemAllocatedDiscount,
                net_total: lineTotal - itemAllocatedDiscount
            };
        });

        return {
            success: true,
            data: {
                applied_codes: appliedCodes,
                summary: {
                    gross_subtotal: grossSubtotal,
                    item_discount_total: itemDiscount,
                    gross_shipping: grossShipping,
                    shipping_discount_total: shippingDiscount,
                    tax_total: taxTotal,
                    grand_total: grandTotal
                },
                allocated_line_items: allocatedItems
            }
        };
    }
}