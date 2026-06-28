import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native'
import { PickerModal } from '../components/PickerModal'
import { NumericInput } from '../components/NumericInput'
import { fetchCustomers, fetchStockItems, createSaleReturn } from '../lib/api'
import type { Customer, StockItem } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

export function QuickSaleReturnScreen() {
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [customer, setCustomer]     = useState<Customer | null>(null)
  const [item, setItem]             = useState<StockItem | null>(null)
  const [quantity, setQuantity]     = useState(0)
  const [rate, setRate]             = useState(0)
  const [reason, setReason]         = useState('')
  const [showCustomer, setShowCustomer] = useState(false)
  const [showItem, setShowItem]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchStockItems()])
      .then(([c, s]) => { setCustomers(c); setStockItems(s) })
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoadingData(false))
  }, [])

  const amount = quantity * rate

  const reset = () => {
    setCustomer(null); setItem(null); setQuantity(0); setRate(0); setReason('')
  }

  const handleSubmit = async () => {
    if (!customer) return Alert.alert('Required', 'Select a customer.')
    if (!item)     return Alert.alert('Required', 'Select a stock item.')
    if (quantity <= 0) return Alert.alert('Required', 'Enter quantity.')
    if (rate <= 0)     return Alert.alert('Required', 'Enter rate.')

    setSaving(true)
    try {
      await createSaleReturn({ customerId: customer.id, stockItemId: item.id, quantity, rate, date: today(), reason: reason || undefined })
      Alert.alert('Saved', `Return of PKR ${amount.toLocaleString()} recorded.`, [{ text: 'OK', onPress: reset }])
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

  if (loadingData) return <ActivityIndicator size="large" color="#dc2626" style={{ flex: 1 }} />

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Sale Return</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Customer</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowCustomer(true)}>
            <Text style={customer ? styles.pickerValue : styles.pickerPlaceholder}>
              {customer?.name ?? 'Select customer…'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Stock Item</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowItem(true)}>
            <Text style={item ? styles.pickerValue : styles.pickerPlaceholder}>
              {item?.name ?? 'Select item…'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Quantity</Text>
          <NumericInput value={quantity > 0 ? String(quantity) : ''} placeholder="0" onChangeNumber={setQuantity} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Rate (PKR)</Text>
          <NumericInput value={rate > 0 ? String(rate) : ''} placeholder="0.00" onChangeNumber={setRate} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Quality issue, wrong item…"
            value={reason}
            onChangeText={setReason}
            multiline
          />
        </View>

        {amount > 0 && (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Return Amount</Text>
            <Text style={styles.amountValue}>PKR {amount.toLocaleString()}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Return</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showCustomer} title="Select Customer" items={customerItems}
        onSelect={(i) => { setCustomer({ id: i.id, name: i.name }); setShowCustomer(false) }}
        onClose={() => setShowCustomer(false)} />
      <PickerModal visible={showItem} title="Select Stock Item" items={stockItemList}
        onSelect={(i) => { setItem(stockItems.find((s) => s.id === i.id)!); setShowItem(false) }}
        onClose={() => setShowItem(false)} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:          { padding: 20, backgroundColor: '#f9fafb', flexGrow: 1 },
  screenTitle:        { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 20 },
  field:              { marginBottom: 16 },
  label:              { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  picker:             { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  pickerValue:        { fontSize: 15, color: '#111' },
  pickerPlaceholder:  { fontSize: 15, color: '#9ca3af' },
  textInput:          { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', minHeight: 60 },
  amountBox:          { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountLabel:        { fontSize: 14, color: '#991b1b', fontWeight: '600' },
  amountValue:        { fontSize: 18, color: '#991b1b', fontWeight: '800' },
  btn:                { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:        { opacity: 0.6 },
  btnText:            { color: '#fff', fontWeight: '700', fontSize: 16 },
})
