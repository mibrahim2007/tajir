import React, { useState, useMemo } from 'react'
import {
  Modal, View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native'

type Item = { id: string; name: string; subtitle?: string }

type Props = {
  visible:   boolean
  title:     string
  items:     Item[]
  loading?:  boolean
  onSelect:  (item: Item) => void
  onClose:   () => void
}

export function PickerModal({ visible, title, items, loading, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items
  }, [items, search])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Search…"
            value={search}
            onChangeText={setSearch}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#059669" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.item}
                onPress={() => { onSelect(item); setSearch('') }}
                activeOpacity={0.6}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                {item.subtitle && <Text style={styles.itemSub}>{item.subtitle}</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No results for "{search}"</Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:      { fontSize: 18, fontWeight: '700', color: '#111' },
  close:      { fontSize: 18, color: '#6b7280', paddingLeft: 12 },
  searchRow:  { paddingHorizontal: 16, paddingBottom: 8 },
  search:     { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111' },
  item:       { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  itemName:   { fontSize: 15, fontWeight: '500', color: '#111' },
  itemSub:    { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empty:      { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
})
