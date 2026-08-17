import type { FastifyReply, FastifyRequest } from "fastify";
import { assertAgentPermission } from "../../../application/permissions/permissions.service.js";
import type { PermissionKey } from "../../../shared/permissions.js";
import { noteRequestPermMs } from "../../../shared/send-timing.js";

/** Debe usarse después de `authenticate` (hook o preHandler). */
export function requirePermission(...keys: PermissionKey[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const user = request.user as { sub?: string } | undefined;
    if (!user?.sub) {
      return;
    }
    const permStarted = performance.now();
    await assertAgentPermission(user.sub, ...keys);
    noteRequestPermMs(request, performance.now() - permStarted);
  };
}
