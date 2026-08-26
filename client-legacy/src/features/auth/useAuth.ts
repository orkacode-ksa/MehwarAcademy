import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@mihwar/shared";
import { api } from "../../api/client.js";

export interface WorkspaceMembership {
  workspaceId: string;
  role: string;
  workspace: { name: string; planCode: string };
}

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: "OWNER" | "ADMIN" | "TEACHER" | "STUDENT";
  totpEnabled: boolean;
  foundingMember: boolean;
  workspaceMemberships: WorkspaceMembership[];
}

const ME_KEY = ["auth", "me"];

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get<Me>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post("/auth/login", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post("/auth/register", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => qc.setQueryData(ME_KEY, undefined),
  });
}
