import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TextInput, StyleSheet,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native'
import { fetchStockItems, fetchLocationStock } from '../lib/api'
import type { StockItem, LocationStock } from '../types'

export function StockLookupScreen() {
  const [items, setItems]         = useState<StockItem[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [locStock, setLocStock]   = useState<Record<string, LocationStock[]>>({})
  const [loadingLoc, setLoadingLoc] = useState<string | null>(null)

  useEffect(() => {
    fetchStockItems()
      .then(setItems)
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!locStock[id]) {
      setLoadingLoc(id)
      try {
        const ls = await fetchLocationStock(id)
        setLocStock((prev) => ({ ...prev, [id]: ls }))
      } catch (e: any) {
        Alert.alert('Error', e.message)
      } finally {
        setLoadingLoc(null)
      }
    }
  }

  if (loading) return <ActivityIndicator size="large" color="#0891b2" style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Stock Lookup</Text>
      <TextInput
        style={styles.search}
        placeholder="Search items…"
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={<Text style={styles.empty}>No items found.</Text>}
        renderItem={({ item }) => {
          const qty = parseFloat(item.current_quantity)
          const isOpen = expanded === item.id
          return (
            <TouchableOpacity onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.count ?? 'units'}</Text>
                </View>
                <View style={[styles.qtyBadge, qty <= 0 && styles.qtyZero]}>
                  <Text style={[styles.qtyText, qty <= 0 && styles.qtyTextZero]}>
                    {qty.toFixed(0)}
                  </Text>
                </View>
              </View>

              {isOpen && (
                <View style={styles.locationBox}>
                  {loadingLoc === item.id ? (
                    <ActivityIndicator size="small" color="#0891b2" />
                  ) : (locStock[item.id] ?? []).length === 0 ? (
                    <Text style={styles.locEmpty}>No location data</Text>
                  ) : (
                    (locStock[item.id] ?? []).map((l) => (
                      <View key={l.location_id} style={styles.locRow}>
                        <Text style={styles.locName}>{l.location_name}</Text>
                        <Text style={styles.locQty}>{l.quantity.toFixed(0)}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  screenTitle:  { fontSize: 20, fontWeight: '700', color: '#111', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  search:       { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111' },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },
  empty:        { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff' },
  itemName:     { fontSize: 15, fontWeight: '500', color: '#111' },
  itemSub:      { fontSize: 12, color: '#6b7280', marginTop: 2 },
  qtyBadge:     { backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  qtyZero:      { backgroundColor: '#fef2f2' },
  qtyText:      { fontWeight: '700', fontSize: 15, color: '#059669' },
  qtyTextZero:  { color: '#dc2626' },
  locationBox:  { backgroundColor: '#f9fafb', paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  locRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  locName:      { fontSize: 13, color: '#374151' },
  locQty:       { fontSize: 13, fontWeight: '600', color: '#0891b2' },
  locEmpty:     { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
})
