import { requireUser } from "../../_shared/auth.js";
import { json } from "../../_shared/http.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  return json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.display_name,
      role: auth.user.role
    }
  });
}
