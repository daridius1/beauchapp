import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

export const NotFoundScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Feather name="alert-triangle" size={64} color={theme.colors.textMuted} style={{ marginBottom: 20 }} />
      <Text style={styles.title}>Esta página no se pudo mostrar</Text>
      <Text style={styles.subtitle}>Es posible que el enlace esté roto, que la página haya sido eliminada, o que no tengas permisos para verla.</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.buttonText}>Ir al Inicio</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
