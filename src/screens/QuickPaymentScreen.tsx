import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native'
import { PickerModal } from '../components/PickerModal'
import { NumericInput } from '../components/NumericInput'
import { fetchSuppliers, createPayment } from '../lib/api'
import type { Supplier } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

export function QuickPaymentScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplier, setSupplier]   = useState<Supplier | null>(null)
  const [amount, setAmount]       = useState(0)
  const [notes, setNotes]         = useState('')
  const [showSupplier, setShowSupplier] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    fetchSuppliers()
      .then(setSuppliers)
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoadingData(false))
  }, [])

  const reset = () => {
    setSupplier(null); setAmount(0); setNotes('')
  }

  const handleSubmit = async () => {
    if (!supplier) return Alert.alert('Required', 'Select a supplier.')
    if (amount <= 0) return Alert.alert('Required', 'Enter amount.')

    setSaving(true)
    try {
      await createPayment({ supplierId: supplier.id, amount, date: today(), notes: notes || undefined })
      Alert.alert('Saved', `Payment of PKR ${amount.toLocaleString()} to ${supplier.name} recorded.`, [{ text: 'OK', onPress: reset }])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const supplierItems = suppliers.map((s) => ({ id: s.id, name: s.name }))

  if (loadingData) return <ActivityIndicator size="large" color="#c2410c" style={{ flex: 1 }} />

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Quick Payment</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Supplier</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowSupplier(true)}>
            <Text style={supplier ? styles.pickerValue : styles.pickerPlaceholder}>
              {supplier?.name ?? 'Select supplier…'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Amount (PKR)</Text>
          <NumericInput value={amount > 0 ? String(amount) : ''} placeholder="0.00" onChangeNumber={setAmount} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Cash, cheque, transfer…"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {amount > 0 && (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Paying Out</Text>
            <Text style={styles.amountValue}>PKR {amount.toLocaleString()}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Payment</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showSupplier} title="Select Supplier" items={supplierItems}
        onSelect={(i) => { setSupplier({ id: i.id, name: i.name }); setShowSupplier(false) }}
        onClose={() => setShowSupplier(false)} />
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
  textInput:          { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  amountBox:          { backgroundColor: '#fff7ed', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountLabel:        { fontSize: 14, color: '#9a3412', fontWeight: '600' },
  amountValue:        { fontSize: 18, color: '#9a3412', fontWeight: '800' },
  btn:                { backgroundColor: '#c2410c', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:        { opacity: 0.6 },
  btnText:            { color: '#fff', fontWeight: '700', fontSize: 16 },
})
