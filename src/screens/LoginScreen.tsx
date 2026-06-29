import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'

export function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]         = useState<'login' | 'signup'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const err = await signIn(email.trim(), password)
    setLoading(false)
    if (err) Alert.alert('Login failed', err)
  }

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter email and password.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.')
      return
    }
    setLoading(true)
    const err = await signUp(email.trim(), password)
    setLoading(false)
    if (err) {
      Alert.alert('Sign up failed', err)
    } else {
      Alert.alert(
        'Account created',
        'Check your email to confirm your account, then sign in.',
        [{ text: 'OK', onPress: () => { setMode('login'); setPassword(''); setConfirm('') } }]
      )
    }
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login')
    setPassword('')
    setConfirm('')
  }

  const isLogin = mode === 'login'

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>Tajir</Text>
          <Text style={styles.sub}>Quick Transaction App</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType={isLogin ? 'done' : 'next'}
            onSubmitEditing={isLogin ? handleLogin : undefined}
            editable={!loading}
          />

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#9ca3af"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              editable={!loading}
            />
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={isLogin ? handleLogin : handleSignUp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchBtn} onPress={switchMode} disabled={loading}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchLink}>{isLogin ? 'Create one' : 'Sign in'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrapper:       { flex: 1, backgroundColor: '#059669' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 28 },
  logo:          { fontSize: 32, fontWeight: '800', color: '#059669', textAlign: 'center', marginBottom: 4 },
  sub:           { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  input:         { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111', marginBottom: 14 },
  btn:           { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchBtn:     { marginTop: 18, alignItems: 'center' },
  switchText:    { fontSize: 14, color: '#6b7280' },
  switchLink:    { color: '#059669', fontWeight: '600' },
})
