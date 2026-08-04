import type { FastifyReply, FastifyRequest } from "fastify";
import { assertAgentPermission } from "../../../application/permissions/permissions.service.js";
import type { PermissionKey } from "../../../shared/permissions.js";

/** Debe usarse después de `authenticate` (hook o preHandler). */
export function requirePermission(...keys: PermissionKey[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = request.user as { sub?: string } | undefined;
    if (!user?.sub) {
      return;
    }
    await assertAgentPermission(user.sub, ...keys);
  };
}
