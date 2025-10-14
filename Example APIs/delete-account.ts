/*
Example Delete User API Usage
- This script is used in my actual app.
- You might have to change a few things if you want to use this as an example.
*/

import { getSessionUserId } from "../utils/session";

export async function onRequestDelete(context: any) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return new Response(JSON.stringify({
        message: "Not authenticated"
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!env.DB) {
      return new Response(JSON.stringify({
        message: "Database not configured"
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete user data
    const { drizzle } = await import('drizzle-orm/d1');
    const { users, generationRequests, customToolTypes, customCategories } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const db = drizzle(env.DB);

    // Delete all user data (cascade)
    await db.delete(generationRequests).where(eq(generationRequests.userId, userId));
    await db.delete(customToolTypes).where(eq(customToolTypes.userId, userId));
    await db.delete(customCategories).where(eq(customCategories.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    // Clear session cookie
    const response = new Response(JSON.stringify({
      success: true,
      message: 'Account deleted successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      }
    });

    return response;

  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(JSON.stringify({
      message: 'Failed to delete account'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
