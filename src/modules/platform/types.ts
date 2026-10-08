import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

// Utilisateurs
export type PlatformUser = Schemas['UserResponse']
export type PlatformUserCreate = Schemas['UserCreate']
export type PlatformUserUpdate = Schemas['UserUpdate']
export type UserRoleId = PlatformUserCreate['role']

// Offres
export type Tier = Schemas['SubscriptionTierResponse']
export type TierCreate = Schemas['SubscriptionTierCreate']
export type TierUpdate = Schemas['SubscriptionTierUpdate']

// Abonnements
export type Subscription = Schemas['SubscriptionResponse']
export type SubscriptionCreate = Schemas['SubscriptionCreate']
export type SubscriptionStatus = Schemas['SubscriptionStatus']
export type DailyBalance = Schemas['DailyBalanceResponse']
export type DailyBalanceCreate = Schemas['DailyBalanceCreate']

// Opérateurs mobiles
export type OperatorPrefix = Schemas['MobileOperatorPrefixResponse']
export type OperatorPrefixCreate = Schemas['MobileOperatorPrefixCreate']
export type OperatorPrefixUpdate = Schemas['MobileOperatorPrefixUpdate']

// Restaurants (pour désigner le propriétaire d'un abonnement)
export type PlatformRestaurant = Schemas['RestaurantResponse']
