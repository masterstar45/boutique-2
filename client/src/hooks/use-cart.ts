import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

// Helper to get or create a session ID
export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("cart_session_id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem("cart_session_id", id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}

export function useCart() {
  const sessionId = useSessionId();
  
  return useQuery({
    queryKey: [api.cart.list.path, sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const url = buildUrl(api.cart.list.path, { sessionId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cart");
      return api.cart.list.responses[200].parse(await res.json());
    },
    enabled: !!sessionId,
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  const sessionId = useSessionId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (productId: number) => {
      if (!sessionId) throw new Error("No session");
      
      const data = {
        sessionId,
        productId,
        quantity: 1,
      };

      const res = await fetch(api.cart.add.path, {
        method: api.cart.add.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.cart.add.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to add to cart");
      }
      return api.cart.add.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path, sessionId] });
      toast({
        title: "Added to cart",
        description: "Product has been added to your cart",
        duration: 2000,
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  const sessionId = useSessionId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.cart.remove.path, { id });
      const res = await fetch(url, { 
        method: api.cart.remove.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to remove item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path, sessionId] });
      toast({
        title: "Removed",
        description: "Item removed from cart",
        duration: 2000,
      });
    },
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  const sessionId = useSessionId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!sessionId) return;
      const url = buildUrl(api.cart.clear.path, { sessionId });
      const res = await fetch(url, { 
        method: api.cart.clear.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to clear cart");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cart.list.path, sessionId] });
      toast({
        title: "Cart cleared",
        description: "Your cart is now empty",
        duration: 2000,
      });
    },
  });
}
