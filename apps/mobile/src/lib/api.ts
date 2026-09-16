import type { FavoriteDto, ListingCard, ListingDetail, SearchParseResponse, SessionUser } from '@lokacia/contracts';
import { createApiClient } from './api-client';
import { API_URL } from './config';
import { createStore } from './store';
import { secureTokenStore } from './token-store';

/** Bumped when the refresh token is rejected — the session provider signs the user out. */
export const sessionExpired = createStore(0);

export const api = createApiClient({
  baseUrl: API_URL,
  store: secureTokenStore,
  onSessionExpired: () => sessionExpired.set((n) => n + 1),
});

/* ------- response shapes not exported by @lokacia/contracts (mirrors the API, see /v1/openapi.json) ------- */

export type SearchPage = { items: ListingCard[]; total: number; nextCursor: string | null; tookMs?: number };
export type MapPin = { id: string; slug: string; lat: number; lng: number; priceMinor: number; areaM2: number; dealType: ListingCard['dealType']; vip: boolean; title: string; businessType: string | null };
export type BusinessTypeDto = { id: string; slug: string; nameKa: string; icon: string; filterConfig: { filters: { key: string; kind: 'boolean' | 'min'; labelKa: string; unit?: string }[] } };
export type DistrictDto = { id: string; slug: string; city: string; nameKa: string; activeCount: number };
export type ListingDetailDto = ListingDetail & { canManage?: boolean; isFavorite?: boolean };
export type SlotDto = { id: string; kind: 'viewing' | 'short_term'; startsAt: string; endsAt: string; priceMinor: number | null; booked?: boolean };
export type ConversationDto = {
  id: string;
  listing: { id: string; slug: string; title: string; cover: string | null } | null;
  other: { id: string; name: string | null; avatarUrl: string | null } | null;
  subject: string | null;
  lastMessage: { body: string; at: string; mine: boolean } | null;
  lastMessageAt: string | null;
  unread: number;
};
export type MessageDto = { id: string; conversationId: string; senderId: string; body: string; attachments: { url: string; name: string; type: string }[]; readAt: string | null; createdAt: string };
export type ViewingDto = {
  id: string;
  listingId: string;
  startsAt: string;
  endsAt: string;
  mode: 'onsite' | 'video';
  status: 'requested' | 'confirmed' | 'cancelled' | 'done';
  videoUrl: string | null;
  note: string | null;
  myRole: 'visitor' | 'host';
  listing: { id: string; slug: string; title: string; address: string; cover: string | null };
  visitor: { id: string; name: string | null; phone: string | null };
  host: { id: string; name: string | null; phone: string | null };
};
export type OfferDto = { id: string; listingId: string; fromUserId: string; toUserId: string; priceMinor: number; termMonths: number; freeMonths: number; indexationPct: number; status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn'; message: string | null; createdAt: string };
export type OfferThreadDto = {
  rootId: string;
  latest: OfferDto;
  count: number;
  listing: { id: string; slug: string; title: string; address: string; priceMinor: number; pricePeriod: string; areaM2: number; cover: string | null };
  counterpart: { id: string; name: string | null; avatarUrl: string | null };
  direction: 'sent' | 'received';
  actionRequired: boolean;
};

export const endpoints = {
  me: () => api.request<SessionUser>('/auth/me'),
  providers: () => api.request<{ google: boolean; otpDevCode: string | null }>('/auth/providers', { auth: false }),
  search: (query: URLSearchParams) => api.request<SearchPage>('/listings', { query }),
  mapPins: (query: URLSearchParams) => api.request<MapPin[]>('/listings/map', { query }),
  parse: (text: string) => api.request<SearchParseResponse>('/search/parse', { method: 'POST', body: { text } }),
  businessTypes: () => api.request<BusinessTypeDto[]>('/taxonomy/business-types'),
  districts: () => api.request<DistrictDto[]>('/taxonomy/districts'),
  listing: (idOrSlug: string) => api.request<ListingDetailDto>(`/listings/${encodeURIComponent(idOrSlug)}`),
  revealPhone: (id: string) => api.request<{ phone: string | null; name: string | null }>(`/listings/${id}/reveal-phone`, { method: 'POST' }),
  slots: (id: string) => api.request<SlotDto[]>(`/listings/${id}/slots`),
  favorites: () => api.request<FavoriteDto[]>('/favorites'),
  favoriteIds: () => api.request<string[]>('/favorites/ids'),
  addFavorite: (listingId: string) => api.request('/favorites', { method: 'POST', body: { listingId } }),
  removeFavorite: (listingId: string) => api.request(`/favorites/${listingId}`, { method: 'DELETE' }),
  conversations: () => api.request<ConversationDto[]>('/conversations'),
  conversation: (id: string) => api.request<ConversationDto>(`/conversations/${id}`),
  startConversation: (listingId: string, body: string) => api.request<{ conversationId: string; message: MessageDto }>('/conversations', { method: 'POST', body: { listingId, body } }),
  messages: (id: string) => api.request<{ items: MessageDto[]; nextCursor: string | null }>(`/conversations/${id}/messages`, { query: { limit: 50 } }),
  sendMessage: (id: string, body: string) => api.request<MessageDto>(`/conversations/${id}/messages`, { method: 'POST', body: { body } }),
  markRead: (id: string) => api.request(`/conversations/${id}/read`, { method: 'POST' }),
  viewings: () => api.request<ViewingDto[]>('/viewings'),
  bookViewing: (body: { listingId: string; slotId?: string; startsAt?: string; mode: 'onsite' | 'video'; note?: string | null }) => api.request<ViewingDto>('/viewings', { method: 'POST', body }),
  confirmViewing: (id: string) => api.request(`/viewings/${id}/confirm`, { method: 'POST' }),
  cancelViewing: (id: string) => api.request(`/viewings/${id}/cancel`, { method: 'POST', body: {} }),
  offers: () => api.request<OfferThreadDto[]>('/offers'),
  sendOffer: (body: { listingId: string; priceMinor: number; termMonths: number; freeMonths: number; indexationPct: number; fitoutPaidBy: 'tenant' | 'owner' | 'shared'; equipmentIncluded: boolean; message?: string | null }) =>
    api.request<OfferDto>('/offers', { method: 'POST', body }),
  offerAction: (id: string, action: 'accept' | 'reject' | 'withdraw') => api.request(`/offers/${id}/${action}`, { method: 'POST', body: {} }),
  registerPushToken: (token: string, platform: 'ios' | 'android' | 'web') => api.request<{ ok: true; devices: number }>('/users/me/push-token', { method: 'POST', body: { token, platform } }),
  unregisterPushToken: (token: string) => api.request('/users/me/push-token', { method: 'DELETE', body: { token } }),
  createDraftListing: (orgId: string, body: Record<string, unknown>) => api.request<{ id: string; slug: string }>('/listings', { method: 'POST', body: { ...body, submit: false }, orgId }),
};
