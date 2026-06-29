import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { PickerModal } from '../components/PickerModal'
import { NumericInput } from '../components/NumericInput'
import { fetchCustomers, fetchStockItems, fetchLocations, createSale } from '../lib/api'
import type { Customer, StockItem } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

export function QuickSaleScreen() {
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [stockItems, setStockItems]   = useState<StockItem[]>([])
  const [locations, setLocations]     = useState<{ id: string; name: string }[]>([])
  const [customer, setCustomer]       = useState<Customer | null>(null)
  const [item, setItem]               = useState<StockItem | null>(null)
  const [location, setLocation]       = useState<{ id: string; name: string } | null>(null)
  const [quantity, setQuantity]       = useState(0)
  const [rate, setRate]               = useState(0)
  const [showCustomer, setShowCustomer] = useState(false)
  const [showItem, setShowItem]       = useState(false)
  const [showLocation, setShowLocation] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchStockItems(), fetchLocations()])
      .then(([c, s, locs]) => { setCustomers(c); setStockItems(s); setLocations(locs) })
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoadingData(false))
  }, [])

  const amount = quantity * rate

  const reset = () => {
    setCustomer(null); setItem(null); setLocation(null); setQuantity(0); setRate(0)
  }

  const handleSubmit = async () => {
    if (!customer)     return Alert.alert('Required', 'Select a customer.')
    if (!item)         return Alert.alert('Required', 'Select a stock item.')
    if (quantity <= 0) return Alert.alert('Required', 'Enter quantity.')
    if (rate <= 0)     return Alert.alert('Required', 'Enter rate.')

    setSaving(true)
    try {
      await createSale({
        customerId: customer.id,
        stockItemId: item.id,
        quantity,
        rate,
        date: today(),
        locationId: location?.id,
      })
      Alert.alert('Saved', `Sale of PKR ${amount.toLocaleString()} recorded.`, [{ text: 'OK', onPress: reset }])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const customerItems = customers.map((c) => ({ id: c.id, name: c.name }))
  const stockItemList = stockItems.map((s) => ({
    id: s.id, name: s.name,
    subtitle: `Qty: ${parseFloat(s.current_quantity).toFixed(0)} ${s.count ?? 'units'}`,
  }))
  const locationItems = locations.map((l) => ({ id: l.id, name: l.name }))

  if (loadingData) return <ActivityIndicator size="large" color="#059669" style={{ flex: 1 }} />

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Quick Sale</Text>

        <Field label="Customer">
          <TouchableOpacity style={styles.picker} onPress={() => setShowCustomer(true)}>
            <Text style={customer ? styles.pickerValue : styles.pickerPlaceholder}>
              {customer?.name ?? 'Select customer…'}
            </Text>
          </TouchableOpacity>
        </Field>

        <Field label="Stock Item">
          <TouchableOpacity style={styles.picker} onPress={() => setShowItem(true)}>
            <Text style={item ? styles.pickerValue : styles.pickerPlaceholder}>
              {item?.name ?? 'Select item…'}
            </Text>
          </TouchableOpacity>
        </Field>

        <Field label="Location (optional)">
          <TouchableOpacity style={styles.picker} onPress={() => setShowLocation(true)}>
            <Text style={location ? styles.pickerValue : styles.pickerPlaceholder}>
              {location?.name ?? 'Select location…'}
            </Text>
          </TouchableOpacity>
        </Field>

        <Field label="Quantity">
          <NumericInput
            value={quantity > 0 ? String(quantity) : ''}
            placeholder="0"
            onChangeNumber={setQuantity}
          />
        </Field>

        <Field label="Rate (PKR)">
          <NumericInput
            value={rate > 0 ? String(rate) : ''}
            placeholder="0.00"
            onChangeNumber={setRate}
          />
        </Field>

        {amount > 0 && (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>PKR {amount.toLocaleString()}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Sale</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showCustomer} title="Select Customer" items={customerItems}
        onSelect={(i) => { setCustomer({ id: i.id, name: i.name }); setShowCustomer(false) }}
        onClose={() => setShowCustomer(false)} />
      <PickerModal visible={showItem} title="Select Stock Item" items={stockItemList}
        onSelect={(i) => { setItem(stockItems.find((s) => s.id === i.id)!); setShowItem(false) }}
        onClose={() => setShowItem(false)} />
      <PickerModal visible={showLocation} title="Select Location" items={locationItems}
        onSelect={(i) => { setLocation({ id: i.id, name: i.name }); setShowLocation(false) }}
        onClose={() => setShowLocation(false)} />
    </KeyboardAvoidingView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container:         { padding: 20, backgroundColor: '#f9fafb', flexGrow: 1 },
  screenTitle:       { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 20 },
  field:             { marginBottom: 16 },
  label:             { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  picker:            { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  pickerValue:       { fontSize: 15, color: '#111' },
  pickerPlaceholder: { fontSize: 15, color: '#9ca3af' },
  amountBox:         { backgroundColor: '#ecfdf5', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountLabel:       { fontSize: 14, color: '#065f46', fontWeight: '600' },
  amountValue:       { fontSize: 18, color: '#065f46', fontWeight: '800' },
  btn:               { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:       { opacity: 0.6 },
  btnText:           { color: '#fff', fontWeight: '700', fontSize: 16 },
})
