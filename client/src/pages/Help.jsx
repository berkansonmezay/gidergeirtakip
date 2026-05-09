import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, BookOpen, Lightbulb, Shield, Wallet, Calendar, LayoutDashboard, ArrowLeftRight, CreditCard, PiggyBank, Settings } from 'lucide-react';

const helpTopics = [
  {
    id: 'dashboard',
    title: 'Kontrol Paneli (Dashboard)',
    icon: <LayoutDashboard className="w-5 h-5 text-indigo-500" />,
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Kontrol Paneli, finansal durumunuzun anlık bir özetini sunar.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Toplam Gelir ve Gider:</strong> Tüm zamanlardaki veya seçili periyottaki toplam gelir ve giderlerinizi gösterir.</li>
          <li><strong>Kalan Bakiye:</strong> Net nakit durumunuzu yansıtır.</li>
          <li><strong>Toplam Tasarruf:</strong> Tasarruf hedeflerinizde biriktirdiğiniz toplam tutardır.</li>
          <li><strong>Grafikler:</strong> Aylık gelir-gider trendlerinizi ve kategori bazında harcama dağılımınızı görselleştirir.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'transactions',
    title: 'İşlemler Nasıl Eklenir?',
    icon: <ArrowLeftRight className="w-5 h-5 text-emerald-500" />,
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Gelir veya gider eklemek için "İşlemler" menüsünü veya sağ üstteki "Hızlı Ekle" butonunu kullanabilirsiniz.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Tutar ve Tarih:</strong> İşlemin miktarını ve gerçekleştiği tarihi girin.</li>
          <li><strong>Kategori ve Harcama Yeri:</strong> İşlemi gruplamak için uygun bir kategori ve harcama yeri (market, kurum vb.) seçin.</li>
          <li><strong>Açıklama:</strong> İşlemi daha sonra kolay hatırlamak için kısa bir not düşün.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'installments',
    title: 'Taksitli İşlemler ve Takip',
    icon: <CreditCard className="w-5 h-5 text-blue-500" />,
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Taksitli Borçlar ve Alacaklar sayfaları, uzun vadeli ödemelerinizi yönetmenizi sağlar.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Taksit Ekleme:</strong> Toplam tutar ve taksit sayısını girdiğinizde sistem aylık ödemeleri otomatik böler.</li>
          <li><strong>Ödeme Yapma:</strong> Günü gelen taksiti "Öde" butonuna basarak kapattığınızda, bu işlem otomatik olarak "İşlemler" listesine yansır ve bakiyenizden düşer.</li>
          <li><strong>Hatırlatıcılar:</strong> Günü yaklaşan veya geçen taksitler için sistem yöneticisi tarafından e-posta bildirimleri gönderilebilir.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'calendar',
    title: 'Takvim ve Raporlar',
    icon: <Calendar className="w-5 h-5 text-amber-500" />,
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Harcamalarınızı zaman çizelgesinde ve detaylı tablolarda inceleyin.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Takvim Görünümü:</strong> Hangi gün ne kadar harcama yaptığınızı takvim üzerinde görün. Bir güne tıklayarak o günkü işlemleri detaylı inceleyebilir ve yeni işlem ekleyebilirsiniz.</li>
          <li><strong>Raporlar:</strong> Kategori Dağılımı ve Aylık Karşılaştırma grafikleri ile bütçe analizi yapın. Raporları PDF veya Excel formatında bilgisayarınıza indirebilirsiniz.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'savings',
    title: 'Tasarruf Hedefleri',
    icon: <PiggyBank className="w-5 h-5 text-pink-500" />,
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Belirli hedefler için para, altın veya döviz biriktirebilirsiniz.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Hedef Oluşturma:</strong> Araba, Tatil veya Acil Durum Fonu gibi hedefler belirleyin. Hedef tutarı girmek zorunlu değildir.</li>
          <li><strong>Birikim Ekleme:</strong> Altın veya döviz gibi değişken kurlu birikimlerde birim fiyatı (örn: gram altın fiyatı) girerek güncel TL karşılığını otomatik hesaplatabilirsiniz.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'settings',
    title: 'Ayarlar ve Yönetim',
    icon: <Settings className="w-5 h-5 text-gray-500" />,
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Hesap ve uygulama tercihlerinizi Ayarlar sayfasından yönetebilirsiniz.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Profil ve Şifre:</strong> Adınızı, e-posta adresinizi ve giriş şifrenizi güncelleyebilirsiniz.</li>
          <li><strong>Görünüm:</strong> Uygulamanın Açık (Light) veya Koyu (Dark) temasını seçebilirsiniz.</li>
          <li><strong>Yönetici İşlemleri:</strong> Eğer Admin veya Aile Yöneticisi yetkisine sahipseniz, yeni kullanıcı ekleyebilir, silebilir ve e-posta (SMTP) ayarlarını yapılandırabilirsiniz.</li>
        </ul>
      </div>
    )
  }
];


export default function Help() {
  const [openTopic, setOpenTopic] = useState(helpTopics[0].id);

  const toggleTopic = (id) => {
    setOpenTopic(openTopic === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg">
          <BookOpen size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Yardım Merkezi</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aile Bütçesi uygulamasını nasıl kullanacağınızı öğrenin</p>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-5 border-l-4 border-l-[var(--primary)] flex gap-4 items-start">
          <Lightbulb className="w-6 h-6 text-[var(--primary)] shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Hızlı Ekle Kısayolu</h4>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sağ üst köşedeki "Hızlı Ekle" butonunu kullanarak hangi sayfada olursanız olun saniyeler içinde yeni bir gelir, gider veya taksit kaydı oluşturabilirsiniz.</p>
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500 flex gap-4 items-start">
          <Shield className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Verileriniz Güvende</h4>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Hesabınız şifrelenmiştir ve verileriniz bulut üzerinde güvenle saklanır. Herhangi bir cihazdan giriş yaparak bütçenizi yönetmeye devam edebilirsiniz.</p>
          </div>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold mb-4 ml-1" style={{ color: 'var(--text-primary)' }}>Sık Sorulan Sorular ve Rehber</h3>
        {helpTopics.map((topic) => (
          <div 
            key={topic.id} 
            className="card overflow-hidden transition-all duration-200 border"
            style={{ borderColor: openTopic === topic.id ? 'var(--primary)' : 'var(--border)' }}
          >
            <button
              onClick={() => toggleTopic(topic.id)}
              className="w-full flex items-center justify-between p-5 text-left bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                  {topic.icon}
                </div>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{topic.title}</span>
              </div>
              <div className="text-[var(--text-muted)]">
                {openTopic === topic.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>
            
            <div 
              className={`transition-all duration-300 ease-in-out ${openTopic === topic.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
              style={{ overflow: 'hidden' }}
            >
              <div className="p-5 pt-0 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
                <div className="mt-4">
                  {topic.content}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contact Support */}
      <div className="mt-8 text-center p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)]">
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Daha fazla yardıma mı ihtiyacınız var?</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sistem yöneticinizle veya aile yöneticinizle iletişime geçebilirsiniz.</p>
      </div>
    </div>
  );
}
