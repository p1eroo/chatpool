import { useQuery } from "@tanstack/react-query";
import { env } from "@/config/env";
import { getContactsForInbox } from "@/data/mock";
import { contactApiService } from "@/services/contactApiService";

export const contactKeys = {
  all: ["contacts"] as const,
  list: () => [...contactKeys.all, "list"] as const,
};

export function useContacts() {
  return useQuery({
    queryKey: contactKeys.list(),
    queryFn: async () => {
      if (env.useMock) {
        return getContactsForInbox(null);
      }
      return contactApiService.list();
    },
    staleTime: 30_000,
  });
}
