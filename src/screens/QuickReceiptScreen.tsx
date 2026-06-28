import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native'
import { PickerModal } from '../components/PickerModal'
import { NumericInput } from '../components/NumericInput'
import { fetchCustomers, createReceipt } from '../lib/api'
import type { Customer } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

export function QuickReceiptScreen() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customer, setCustomer]   = useState<Customer | null>(null)
  const [amount, setAmount]       = useState(0)
  const [notes, setNotes]         = useState('')
  const [showCustomer, setShowCustomer] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoadingData(false))
  }, [])

  const reset = () => {
    setCustomer(null); setAmount(0); setNotes('')
  }

  const handleSubmit = async () => {
    if (!customer) return Alert.alert('Required', 'Select a customer.')
    if (amount <= 0) return Alert.alert('Required', 'Enter amount.')

    setSaving(true)
    try {
      await createReceipt({ customerId: customer.id, amount, date: today(), notes: notes || undefined })
      Alert.alert('Saved', `Receipt of PKR ${amount.toLocaleString()} from ${customer.name} recorded.`, [{ text: 'OK', onPress: reset }])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const customerItems = customers.map((c) => ({ id: c.id, name: c.name }))

  if (loadingData) return <ActivityIndicator size="large" color="#7c3aed" style={{ flex: 1 }} />

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Quick Receipt</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Customer</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowCustomer(true)}>
            <Text style={customer ? styles.pickerValue : styles.pickerPlaceholder}>
              {customer?.name ?? 'Select customer…'}
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
            <Text style={styles.amountLabel}>Receiving</Text>
            <Text style={styles.amountValue}>PKR {amount.toLocaleString()}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Receipt</Text>}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal visible={showCustomer} title="Select Customer" items={customerItems}
        onSelect={(i) => { setCustomer({ id: i.id, name: i.name }); setShowCustomer(false) }}
        onClose={() => setShowCustomer(false)} />
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
  amountBox:          { backgroundColor: '#f5f3ff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  amountLabel:        { fontSize: 14, color: '#5b21b6', fontWeight: '600' },
  amountValue:        { fontSize: 18, color: '#5b21b6', fontWeight: '800' },
  btn:                { backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:        { opacity: 0.6 },
  btnText:            { color: '#fff', fontWeight: '700', fontSize: 16 },
})
