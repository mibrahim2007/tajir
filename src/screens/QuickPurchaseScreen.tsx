import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { PickerModal } from '../components/PickerModal'
import { NumericInput } from '../components/NumericInput'
import { fetchSuppliers, fetchStockItems, createPurchase } from '../lib/api'
import type { Supplier, StockItem } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

export function QuickPurchaseScreen() {
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [supplier, setSupplier]     = useState<Supplier | null>(null)
  const [item, setItem]             = useState<StockItem | null>(null)
  const [quantity, setQuantity]     = useState(0)
  const [rate, setRate]             = useState(0)
  const [showSupplier, setShowSupplier] = useState(false)
  const [showItem, setShowItem]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([fetchSuppliers(), fetchStockItems()])
      .then(([s, items]) => { setSuppliers(s); setStockItems(items) })
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoadingData(false))
  }, [])

  const amount = quantity * rate

  const reset = () => {
    setSupplier(null); setItem(null); setQuantity(0); setRate(0)
  }

  const handleSubmit = async () => {
    if (!supplier) return Alert.alert('Required', 'Select a supplier.')
    if (!item)     return Alert.alert('Required', 'Select a stock item.')
    if (quantity <= 0) return Alert.alert('Required', 'Enter quantity.')
    if (rate <= 0)     return Alert.alert('Required', 'Enter rate.')

    setSaving(true)
    try {
      await createPurchase({ supplierId: supplier.id, stockItemId: item.id, quantity, rate, date: today() })
      Alert.alert('Saved', `Purchase of PKR ${amount.toLocaleString()} recorded.`, [{ text: 'OK', onPress: reset }])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const supplierItems = suppliers.map((s) => ({ id: s.id, name: s.name }))
  const stockItemList = stockItems.map((s) => ({
    id: s.id, name: s.name,
    subtitle: `Qty: ${parseFloat(s.current_quantity).toFixed(0)} ${s.count ?? 'units'}`,
  }))

  if (loadingData) return <ActivityIndicator size="large" color="#2563eb" style={{ flex: 1 }} />

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Quick Purchase</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Supplier</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowSupplier(true)}>
            <Text style={supplier ? styles.pickerValue : styles.pickerPlaceholder}>
              {supplier?.name ?? 'Select supplier…'}
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

        {amount > 0 && (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>PKR {amount.toLocaleString()}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Purchase</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showSupplier} title="Select Supplier" items={supplierItems}
        onSelect={(i) => { setSupplier({ id: i.id, name: i.name }); setShowSupplier(false) }}
        onClose={() => setShowSupplier(false)} />
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
  amountBox:          { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountLabel:        { fontSize: 14, color: '#1e40af', fontWeight: '600' },
  amountValue:        { fontSize: 18, color: '#1e40af', fontWeight: '800' },
  btn:                { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:        { opacity: 0.6 },
  btnText:            { color: '#fff', fontWeight: '700', fontSize: 16 },
})
