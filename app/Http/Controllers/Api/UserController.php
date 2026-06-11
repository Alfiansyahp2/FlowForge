<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    /**
     * List all users in the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $search  = $request->input('search');
        $role    = $request->input('role');

        $query = User::query()->with('roles');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role) {
            $query->where('role', $role);
        }

        $users = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $users->map(fn($u) => $this->format($u)),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page'    => $users->lastPage(),
                'per_page'     => $users->perPage(),
                'total'        => $users->total(),
            ],
        ]);
    }

    /**
     * Show a single user.
     */
    public function show(User $user): JsonResponse
    {
        return response()->json(['data' => $this->format($user->load('roles'))]);
    }

    /**
     * Create a new user in the same tenant.
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => [
                'required', 'email', 'max:255',
                Rule::unique('users')->where('tenant_id', $tenantId),
            ],
            'password' => ['required', 'confirmed', Password::defaults()],
            'role'     => ['required', Rule::in(['admin', 'editor', 'viewer'])],
        ]);

        $user = User::create([
            'tenant_id' => $tenantId,
            'name'      => $validated['name'],
            'email'     => $validated['email'],
            'password'  => Hash::make($validated['password']),
            'role'      => $validated['role'],
            'is_active' => true,
        ]);

        $user->assignRole($validated['role']);

        return response()->json(['data' => $this->format($user), 'message' => 'User created successfully'], 201);
    }

    /**
     * Update a user's name, email, role, or active status.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'email'     => [
                'sometimes', 'email', 'max:255',
                Rule::unique('users')->where('tenant_id', $tenantId)->ignore($user->id),
            ],
            'role'      => ['sometimes', Rule::in(['admin', 'editor', 'viewer'])],
            'is_active' => ['sometimes', 'boolean'],
            'password'  => ['sometimes', 'confirmed', Password::defaults()],
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        // Sync Spatie role if role field changed
        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        return response()->json(['data' => $this->format($user->fresh('roles')), 'message' => 'User updated successfully']);
    }

    /**
     * Soft-delete a user. Cannot delete yourself.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account'], 422);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * Assign a role to a user (manage roles permission).
     */
    public function assignRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', Rule::in(['admin', 'editor', 'viewer'])],
        ]);

        $user->update(['role' => $validated['role']]);
        $user->syncRoles([$validated['role']]);

        return response()->json(['data' => $this->format($user->fresh('roles')), 'message' => 'Role updated successfully']);
    }

    /**
     * Format user for API response.
     */
    private function format(User $user): array
    {
        return [
            'id'         => $user->id,
            'name'       => $user->name,
            'email'      => $user->email,
            'role'       => $user->role,
            'is_active'  => $user->is_active,
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
        ];
    }
}
