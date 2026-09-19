import client from './client';
import publicClient from './publicClient';

export interface Invite {
    _id: string;
    email: string;
    expiresAt: string;
    createdAt: string;
    createdBy: { name: string };
}

export interface InvitePreview {
    email: string;
    workspaceName: string;
}

export const createInvite = (email: string) =>
    client.post<{ inviteUrl: string }>('/invites', { email });

export const getInvites = () =>
    client.get<Invite[]>('/invites');

export const revokeInvite = (id: string) =>
    client.delete(`/invites/${id}`);

export const getInvitePreview = (token: string) =>
    publicClient.get<InvitePreview>(`/auth/invite/${token}`);

export const acceptInvite = (token: string, name: string, password: string) =>
    publicClient.post<{ token: string; user: { id: string; name: string; email: string; role: 'admin' | 'caseworker'; workspaceId: string } }>(
        '/auth/accept-invite',
        { token, name, password },
    );
