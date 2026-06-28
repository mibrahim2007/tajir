import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TextInput, StyleSheet,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native'
import { fetchCustomers, fetchCustomerBalance, fetchRecentSales } from '../lib/api'
import type { Customer } from '../types'

export function CustomerBalanceScreen() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Customer | null>(null)
  const [balance, setBalance]     = useState<number | null>(null)
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [loadingBalance, setLoadingBalance] = useState(false)

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers

  const selectCustomer = async (c: Customer) => {
    setSelected(c)
    setBalance(null)
    setRecentSales([])
    setLoadingBalance(true)
    try {
      const [bal, sales] = await Promise.all([
        fetchCustomerBalance(c.id),
        fetchRecentSales(c.id),
      ])
      setBalance(bal)
      setRecentSales(sales)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoadingBalance(false)
    }
  }

  if (loading) return <ActivityIndicator size="large" color="#65a30d" style={{ flex: 1 }} />

  if (selected) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => { setSelected(null); setBalance(null) }} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.customerName}>{selected.name}</Text>

        {loadingBalance ? (
          <ActivityIndicator size="large" color="#65a30d" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={[styles.balanceBox, (balance ?? 0) > 0 ? styles.balancePositive : styles.balanceNegative]}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              <Text style={[styles.balanceValue, (balance ?? 0) > 0 ? styles.balPosText : styles.balNegText]}>
                PKR {Math.abs(balance ?? 0).toLocaleString()}
                {(balance ?? 0) < 0 ? ' CR' : ''}
              </Text>
            </View>

            {recentSales.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recent Sales</Text>
                {recentSales.map((s) => (
                  <View key={s.id} style={styles.saleRow}>
                    <View>
                      <Text style={styles.saleDate}>{s.date}</Text>
                      <Text style={styles.saleMeta}>{parseFloat(s.quantity).toFixed(0)} × PKR {parseFloat(s.rate).toLocaleString()}</Text>
                    </View>
                    <Text style={styles.saleAmount}>PKR {parseFloat(s.pkr_equivalent).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Customer Balance</Text>
      <TextInput
        style={styles.search}
        placeholder="Search customers…"
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListEmptyComponent={<Text style={styles.empty}>No customers found.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.custRow} onPress={() => selectCustomer(item)} activeOpacity={0.7}>
            <Text style={styles.custName}>{item.name}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f9fafb' },
  screenTitle:     { fontSize: 20, fontWeight: '700', color: '#111', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  search:          { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111' },
  divider:         { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },
  empty:           { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  custRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff' },
  custName:        { fontSize: 15, color: '#111', fontWeight: '500' },
  chevron:         { fontSize: 20, color: '#9ca3af' },
  backBtn:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  backText:        { color: '#65a30d', fontSize: 15, fontWeight: '600' },
  customerName:    { fontSize: 22, fontWeight: '700', color: '#111', paddingHorizontal: 20, paddingBottom: 16 },
  balanceBox:      { marginHorizontal: 20, borderRadius: 16, padding: 20, marginBottom: 20 },
  balancePositive: { backgroundColor: '#ecfdf5' },
  balanceNegative: { backgroundColor: '#f0fdf4' },
  balanceLabel:    { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  balanceValue:    { fontSize: 28, fontWeight: '800' },
  balPosText:      { color: '#059669' },
  balNegText:      { color: '#15803d' },
  recentSection:   { paddingHorizontal: 20 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
  saleRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8 },
  saleDate:        { fontSize: 13, fontWeight: '600', color: '#111' },
  saleMeta:        { fontSize: 12, color: '#6b7280', marginTop: 2 },
  saleAmount:      { fontSize: 14, fontWeight: '700', color: '#059669' },
})
