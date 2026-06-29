import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../../App'
import { useAuth } from '../contexts/AuthContext'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>

type Tile = {
  label:   string
  icon:    string
  screen:  keyof RootStackParamList
  color:   string
}

const TILES: Tile[] = [
  { label: 'Quick Sale',       icon: '🛒', screen: 'QuickSale',           color: '#059669' },
  { label: 'Sale Return',      icon: '↩️',  screen: 'QuickSaleReturn',     color: '#dc2626' },
  { label: 'Purchase',         icon: '📦', screen: 'QuickPurchase',        color: '#2563eb' },
  { label: 'Purchase Return',  icon: '🔄', screen: 'QuickPurchaseReturn',  color: '#d97706' },
  { label: 'Receipt',          icon: '💳', screen: 'QuickReceipt',         color: '#7c3aed' },
  { label: 'Payment',          icon: '💰', screen: 'QuickPayment',         color: '#c2410c' },
  { label: 'Stock Lookup',     icon: '🔍', screen: 'StockLookup',          color: '#0891b2' },
  { label: 'Customer Balance', icon: '👤', screen: 'CustomerBalance',      color: '#65a30d' },
]

export function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out of Tajir?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tajir</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {TILES.map((t) => (
          <TouchableOpacity
            key={t.screen}
            style={[styles.tile, { borderLeftColor: t.color }]}
            onPress={() => navigation.navigate(t.screen as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9fafb' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  title:      { fontSize: 22, fontWeight: '800', color: '#059669' },
  signOut:    { fontSize: 14, color: '#6b7280' },
  grid:       { padding: 16, gap: 12 },
  tile:       { backgroundColor: '#fff', borderRadius: 14, padding: 20, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  tileIcon:   { fontSize: 28, marginRight: 16 },
  tileLabel:  { fontSize: 16, fontWeight: '600', color: '#111' },
})
