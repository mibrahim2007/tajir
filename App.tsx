import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import { LoginScreen }           from './src/screens/LoginScreen'
import { HomeScreen }            from './src/screens/HomeScreen'
import { QuickSaleScreen }       from './src/screens/QuickSaleScreen'
import { QuickSaleReturnScreen } from './src/screens/QuickSaleReturnScreen'
import { QuickPurchaseScreen }       from './src/screens/QuickPurchaseScreen'
import { QuickPurchaseReturnScreen } from './src/screens/QuickPurchaseReturnScreen'
import { QuickReceiptScreen }    from './src/screens/QuickReceiptScreen'
import { QuickPaymentScreen }    from './src/screens/QuickPaymentScreen'
import { StockLookupScreen }     from './src/screens/StockLookupScreen'
import { CustomerBalanceScreen } from './src/screens/CustomerBalanceScreen'

export type RootStackParamList = {
  Login:                undefined
  Home:                 undefined
  QuickSale:            undefined
  QuickSaleReturn:      undefined
  QuickPurchase:        undefined
  QuickPurchaseReturn:  undefined
  QuickReceipt:         undefined
  QuickPayment:         undefined
  StockLookup:          undefined
  CustomerBalance:      undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

function AppNavigator() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle:      { backgroundColor: '#fff' },
          headerTintColor:  '#059669',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle:     { backgroundColor: '#f9fafb' },
        }}
      >
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home"            component={HomeScreen}            options={{ headerShown: false }} />
            <Stack.Screen name="QuickSale"       component={QuickSaleScreen}       options={{ title: 'Quick Sale' }} />
            <Stack.Screen name="QuickSaleReturn" component={QuickSaleReturnScreen} options={{ title: 'Sale Return' }} />
            <Stack.Screen name="QuickPurchase"       component={QuickPurchaseScreen}       options={{ title: 'Quick Purchase' }} />
            <Stack.Screen name="QuickPurchaseReturn" component={QuickPurchaseReturnScreen} options={{ title: 'Purchase Return' }} />
            <Stack.Screen name="QuickReceipt"    component={QuickReceiptScreen}    options={{ title: 'Quick Receipt' }} />
            <Stack.Screen name="QuickPayment"    component={QuickPaymentScreen}    options={{ title: 'Quick Payment' }} />
            <Stack.Screen name="StockLookup"     component={StockLookupScreen}     options={{ title: 'Stock Lookup' }} />
            <Stack.Screen name="CustomerBalance" component={CustomerBalanceScreen} options={{ title: 'Customer Balance' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
