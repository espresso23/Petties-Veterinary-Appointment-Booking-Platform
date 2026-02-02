import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'
import { petService } from '../../services/api/petService'

export function HomePage() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <section className="page">
      <div className="page__content max-w-4xl mx-auto">
        <header className="mb-8">
          <p className="page__eyebrow">Xin chào, {user?.fullName}</p>
          <h1 className="page__title mb-2">Thú Cưng Của Tôi</h1>
          <p className="text-stone-500">Quản lý hồ sơ và sức khỏe thú cưng</p>
        </header>

        {isAuthenticated && user ? (
          <PetList />
        ) : (
          <div className="text-center py-12">
            <Link to="/auth/login" className="btn btn--primary">Đăng nhập để xem</Link>
          </div>
        )}
      </div>
    </section>
  )
}

function PetList() {
  const [pets, setPets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    petService.getMyPets()
      .then(setPets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Đang tải...</div>

  if (pets.length === 0) {
    return (
      <div className="bg-stone-50 rounded-xl p-8 text-center border border-dashed border-stone-300">
        <p className="text-stone-500 mb-4">Bạn chưa có thú cưng nào.</p>
        {/* Button to add pet could go here */}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {pets.map(pet => (
        <div key={pet.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex gap-4">
          <div className="w-20 h-20 bg-stone-100 rounded-lg flex-shrink-0 overflow-hidden">
            {pet.imageUrl ? (
              <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {pet.species === 'CAT' ? '🐱' : '🐶'}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-stone-800">{pet.name}</h3>
            <p className="text-sm text-stone-500 mb-3">{pet.breed} • {pet.ageYears} tuổi</p>

            <div className="flex flex-wrap gap-2">
              <Link
                to={`/home/pets/${pet.id}/health-record?tab=vaccine`}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
              >
                💉 Tiêm chủng
              </Link>
              <Link
                to={`/home/pets/${pet.id}/health-record?tab=emr`}
                className="px-3 py-1.5 bg-purple-50 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors"
              >
                📋 Bệnh án
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

