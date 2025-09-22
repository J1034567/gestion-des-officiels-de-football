
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { mapEnumToDisplayRole } from '../types';
import { Permissions } from '../hooks/usePermissions';

// --- SUB-COMPONENT: UserRow ---
interface UserRowProps {
    user: User & { email?: string };
    allRoles: { id: string, name: string }[];
    onUpdateUserRole: (userId: string, roleName: string) => void;
    currentUser: User;
    permissions: Permissions;
}

const UserRow: React.FC<UserRowProps> = ({ user, allRoles, onUpdateUserRole, currentUser, permissions }) => {
    const [currentRole, setCurrentRole] = useState(user.role);
    const [initialRole, setInitialRole] = useState(user.role);

    useEffect(() => {
        setCurrentRole(user.role);
        setInitialRole(user.role);
    }, [user.role]);

    const canEdit = permissions.can('edit_role', 'users') && user.id !== currentUser.id;
    const isDirty = currentRole !== initialRole;

    const handleSave = () => {
        onUpdateUserRole(user.id, currentRole);
    };

    const handleCancel = () => {
        setCurrentRole(initialRole);
    };

    return (
        <tr className="hover:bg-gray-700/50">
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-white">{user.full_name}</div>
                <div className="text-xs text-gray-400">{user.email || 'Email non disponible'}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                {canEdit ? (
                    <select
                        value={currentRole}
                        onChange={(e) => setCurrentRole(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    >
                        {allRoles.map(role => (
                            <option key={role.id} value={role.name}>
                                {mapEnumToDisplayRole(role.name)}
                            </option>
                        ))}
                    </select>
                ) : (
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-brand-primary/20 text-brand-primary">
                        {mapEnumToDisplayRole(user.role)}
                    </span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {canEdit && isDirty && (
                    <div className="flex items-center justify-end gap-2">
                         <button onClick={handleCancel} className="text-gray-400 hover:text-white">Annuler</button>
                         <button onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-1 px-3 rounded-lg">
                            Enregistrer
                         </button>
                    </div>
                )}
                 {user.id === currentUser.id && <span className="text-xs text-gray-500 italic">(Vous)</span>}
            </td>
        </tr>
    );
}


// --- MAIN COMPONENT: UserSettings ---
interface UserSettingsProps {
    users: User[];
    allRoles: { id: string; name: string; }[];
    onUpdateUserRole: (userId: string, roleName: string) => void;
    currentUser: User;
    permissions: Permissions;
}

const UserSettings: React.FC<UserSettingsProps> = ({ users, allRoles, onUpdateUserRole, currentUser, permissions }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-2">Gestion des Utilisateurs</h3>
            <p className="text-sm text-gray-400 mb-6">
                Les nouveaux utilisateurs ont par défaut le rôle "Visiteur". Seul un Super Admin peut modifier les rôles.
            </p>
             <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Utilisateur</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rôle</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-700">
                            {users.map(user => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    allRoles={allRoles}
                                    onUpdateUserRole={onUpdateUserRole}
                                    currentUser={currentUser}
                                    permissions={permissions}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        </div>
    )
}

export default UserSettings;
